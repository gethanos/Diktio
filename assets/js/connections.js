/**
 * MIT License
 * 
 * Copyright (c) 2025 Georgalas Athanasios-Antonios (Thanos), CITEd.gr VLE
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { areInSameNetwork, getNetworkAddress, isOnLink, isValidIP } from './network-core.js';
import { buildTopology, getL3Interfaces, getSegmentEndpoints, ping, findIPConflicts } from './routing.js';
import { FIREWALL_PORTS } from './firewall.js';

// Διαχείριση συνδέσεων - ΠΛΗΡΩΣ ΔΙΟΡΘΩΜΕΝΗ ΜΕ INTERNET ACCESS
class ConnectionManager {
    constructor() {
        this.connections = [];
        this.packets = [];
        this.isSimulating = false;
        this.packetInterval = null;
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ====================
    
    // Λήψη IP συσκευής (λειτουργεί και για routers)
    getDeviceIP(device) {
        if (!device) return null;
        if (device.type === 'router') {
            if (device.connectionInterfaces) {
                for (const [connId, interfaceType] of Object.entries(device.connectionInterfaces)) {
                    if (interfaceType === 'lan') return device.interfaces.lan.ip;
                    if (interfaceType === 'lan2') return device.interfaces.lan2.ip;
                    if (interfaceType === 'wan') return device.interfaces.wan.ip;
                }
            }
            return device.interfaces.lan.ip;
        }
        return device.ip;
    }    
    
    getDeviceSubnet(device) {
        if (!device) return '255.255.255.0';
        if (device.type === 'router') {
            return device.interfaces?.lan?.subnetMask || device.interfaces?.wan?.subnetMask || '255.255.255.0';
        }
        return device.subnetMask || '255.255.255.0';
    }
    
    getDeviceGateway(device) {
        if (!device) return null;
        if (device.type === 'router') {
            return device.interfaces?.wan?.gateway;
        }
        return device.gateway;
    }
    
    getDeviceDNS(device) {
        if (!device) return [];
        if (device.type === 'router') {
            return device.interfaces?.lan?.dns || device.interfaces?.wan?.dns || [];
        }
        return device.dns || [];
    }
    

    

    
    // ==================== ΝΕΕΣ ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ROUTERS ====================
    
    getInterfaceForRouterConnection(router, otherRouter) {
        console.log(`[ROUTER INTERFACE] Προσδιορισμός interface για ${router.name} ↔ ${otherRouter.name}`);
        
        if (router.connectionInterfaces) {
            for (const [connId, interfaceType] of Object.entries(router.connectionInterfaces)) {
                const conn = this.connections.find(c => c.id === connId);
                if (conn) {
                    const otherId = conn.device1Id === router.id ? conn.device2Id : conn.device1Id;
                    if (otherId === otherRouter.id) {
                        console.log(`[ROUTER INTERFACE] Βρέθηκε υπάρχουσα: ${interfaceType}`);
                        return interfaceType;
                    }
                }
            }
        }
        
        const routerLanIP = router.interfaces.lan.ip;
        const otherLanIP = otherRouter.interfaces.lan.ip;
        const routerWanIP = router.interfaces.wan.ip;
        const otherWanIP = otherRouter.interfaces.wan.ip;
        
        if (routerWanIP && routerWanIP !== 'N/A' && routerWanIP !== '0.0.0.0') {
            if (otherLanIP && otherLanIP !== 'N/A') {
                const wanNetwork = getNetworkAddress(routerWanIP, router.interfaces.wan.subnetMask);
                const lanNetwork = getNetworkAddress(otherLanIP, otherRouter.interfaces.lan.subnetMask);
                
                if (wanNetwork === lanNetwork) {
                    console.log(`[ROUTER INTERFACE] Router WAN είναι στο LAN του άλλου → WAN interface`);
                    return 'wan';
                }
            }
        }
        
        if (otherWanIP && otherWanIP !== 'N/A' && otherWanIP !== '0.0.0.0') {
            if (routerLanIP && routerLanIP !== 'N/A') {
                const wanNetwork = getNetworkAddress(otherWanIP, otherRouter.interfaces.wan.subnetMask);
                const lanNetwork = getNetworkAddress(routerLanIP, router.interfaces.lan.subnetMask);
                
                if (wanNetwork === lanNetwork) {
                    console.log(`[ROUTER INTERFACE] Άλλος router WAN είναι στο LAN μας → LAN interface`);
                    return 'lan';
                }
            }
        }
        
        console.log(`[ROUTER INTERFACE] Default: LAN interface`);
        return 'lan';
    }
    
    assignRouterWanIP(router, otherRouter) {
        console.log(`[ROUTER WAN IP] Ανάθεση WAN IP για ${router.name} που συνδέεται με ${otherRouter.name}`);
        
        if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A' && router.interfaces.wan.ip !== '0.0.0.0') {
            console.log(`[ROUTER WAN IP] Έχει ήδη WAN IP: ${router.interfaces.wan.ip}`);
            return router.interfaces.wan.ip;
        }
        
        const otherLanIP = otherRouter.interfaces.lan.ip;
        if (otherLanIP && otherLanIP !== 'N/A' && otherLanIP !== '0.0.0.0') {
            const ipParts = otherLanIP.split('.');
            
            for (let i = 2; i < 255; i++) {
                ipParts[3] = i.toString();
                const potentialIP = ipParts.join('.');
                
                const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
                if (!existingDevice || existingDevice.id === router.id) {
                    router.interfaces.wan.ip = potentialIP;
                    router.interfaces.wan.subnetMask = otherRouter.interfaces.lan.subnetMask || '255.255.255.0';
                    router.interfaces.wan.gateway = otherLanIP;
                    
                    console.log(`[ROUTER WAN IP] Ορίστηκε WAN IP: ${potentialIP}, Gateway: ${otherLanIP}`);
                    
                    if (router.element && router.element.querySelector('.device-ip')) {
                        router.element.querySelector('.device-ip').innerHTML = 
                            `WAN: ${potentialIP}<br>LAN: ${router.interfaces.lan.ip}`;
                    }
                    
                    return potentialIP;
                }
            }
        }
        
        router.interfaces.wan.ip = '192.168.1.6';
        router.interfaces.wan.subnetMask = '255.255.255.0';
        router.interfaces.wan.gateway = '192.168.1.1';
        
        console.log(`[ROUTER WAN IP] Fallback WAN IP: 192.168.1.6`);
        return '192.168.1.6';
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΗ ΜΕΘΟΔΟΣ ΓΙΑ ΕΛΕΓΧΟ ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΩΝ INTERFACES ====================
    
getActuallyUsedRouterInterfaces(router) {
    const usedInterfaces = new Set();
    
    console.log(`[USED INTERFACES] Έλεγχος για router: ${router.name}`);
    
    // Έλεγχος από τις πραγματικές συνδέσεις
    this.connections.forEach(conn => {
        if (conn.device1Id === router.id || conn.device2Id === router.id) {
            let interfaceUsed = null;
            
            if (conn.device1Id === router.id && conn.interface1) {
                interfaceUsed = conn.interface1;
            }
            else if (conn.device2Id === router.id && conn.interface2) {
                interfaceUsed = conn.interface2;
            }
            
            if (interfaceUsed) {
                usedInterfaces.add(interfaceUsed);
                console.log(`[USED INTERFACES] Χρησιμοποιείται interface: ${interfaceUsed} από σύνδεση ${conn.id}`);
            }
        }
    });
    
    console.log(`[USED INTERFACES] Router ${router.name}: Χρησιμοποιούνται: ${Array.from(usedInterfaces).join(', ')}`);
    return usedInterfaces;
}
    
    // Βοηθητική μέθοδος για προσδιορισμό interface από σύνδεση - ΒΕΛΤΙΩΜΕΝΗ
    determineInterfaceForConnection(router, connection) {
        console.log(`[INTERFACE DETECT] Έλεγχος interface για: ${router.name}, Σύνδεση: ${connection.id}`);
        
        // 1. Έλεγχος αν υπάρχει ήδη στη σύνδεση
        if (connection.device1Id === router.id && connection.interface1) {
            console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface1}`);
            return connection.interface1;
        }
        if (connection.device2Id === router.id && connection.interface2) {
            console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface2}`);
            return connection.interface2;
        }
        
        // 2. Έλεγχος στο router.connectionInterfaces
        if (router.connectionInterfaces && router.connectionInterfaces[connection.id]) {
            const storedInterface = router.connectionInterfaces[connection.id];
            console.log(`[INTERFACE DETECT] Βρέθηκε στο connectionInterfaces: ${storedInterface}`);
            return storedInterface;
        }
        
        // 3. Βρες την άλλη συσκευή
        const otherDeviceId = connection.device1Id === router.id ? connection.device2Id : connection.device1Id;
        const otherDevice = window.deviceManager.getDeviceById(otherDeviceId);
        
        if (!otherDevice) {
            console.log(`[INTERFACE DETECT] Δεν βρέθηκε άλλη συσκευή για σύνδεση ${connection.id}`);
            return 'lan'; // default
        }
        
        console.log(`[INTERFACE DETECT] Έλεγχος interface για σύνδεση: ${router.name} ↔ ${otherDevice.name}`);
        
        // 4. Έλεγχος αν είναι router-to-router σύνδεση
        if (otherDevice.type === 'router') {
            console.log(`[INTERFACE DETECT] Router-to-router σύνδεση`);
            return this.getInterfaceForRouterConnection(router, otherDevice);
        }
        
        // 5. Για άλλες συσκευές, ελέγχουμε αν είναι στο ίδιο δίκτυο
        const routerLanIP = router.interfaces.lan.ip;
        const routerSubnet = router.interfaces.lan.subnetMask;
        const otherIP = this.getDeviceIP(otherDevice);
        const otherSubnet = this.getDeviceSubnet(otherDevice);
        
        console.log(`[INTERFACE DETECT] Router LAN: ${routerLanIP}/${routerSubnet}, Other: ${otherIP}/${otherSubnet}`);
        
        if (routerLanIP && routerLanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerLanIP, otherIP, routerSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο -> LAN interface`);
                return 'lan';
            }
        }
        
        // 6. Έλεγχος για WAN
        const routerWanIP = router.interfaces.wan.ip;
        const routerWanSubnet = router.interfaces.wan.subnetMask;
        
        if (routerWanIP && routerWanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerWanIP, otherIP, routerWanSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο WAN -> WAN interface`);
                return 'wan';
            }
        }
        
        // 7. Ελέγχουμε για LAN2
        if (router.interfaces.lan2 && router.interfaces.lan2.enabled) {
            const routerLan2IP = router.interfaces.lan2.ip;
            const routerLan2Subnet = router.interfaces.lan2.subnetMask;
            
            if (routerLan2IP && routerLan2IP !== 'N/A' && otherIP && otherIP !== 'N/A') {
                if (areInSameNetwork(routerLan2IP, otherIP, routerLan2Subnet, otherSubnet)) {
                    console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο LAN2 -> LAN2 interface`);
                    return 'lan2';
                }
            }
        }
        
        console.log(`[INTERFACE DETECT] Δεν μπορούσαμε να προσδιορίσουμε, default: lan`);
        return 'lan'; // default
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΗ ΜΕΘΟΔΟΣ ΓΙΑ ΔΙΑΘΕΣΙΜΑ INTERFACES ====================
    
getFreeRouterInterfaces(router) {
    console.log(`[FREE INTERFACES] Έλεγχος για router: ${router.name}`);
    
    const allInterfaces = [];
    
    // Προσθήκη ΔΙΑΘΕΣΙΜΩΝ interfaces
    if (router.interfaces.lan && router.interfaces.lan.ip !== 'N/A') {
        allInterfaces.push('lan');
        console.log(`[FREE INTERFACES] LAN διαθέσιμο: ${router.interfaces.lan.ip}`);
    }
    
    if (router.interfaces.lan2 && 
        router.interfaces.lan2.ip !== 'N/A' && 
        router.interfaces.lan2.enabled) {
        allInterfaces.push('lan2');
        console.log(`[FREE INTERFACES] LAN2 διαθέσιμο: ${router.interfaces.lan2.ip}`);
    }
    
    // ΠΡΟΣΟΧΗ: Το WAN είναι ΠΑΝΤΑ διαθέσιμο για σύνδεση, ακόμα και αν δεν έχει IP!
    // Μπορούμε να του δώσουμε IP όταν συνδεθεί
    if (router.interfaces.wan) {
        allInterfaces.push('wan');
        console.log(`[FREE INTERFACES] WAN διαθέσιμο (τώρα: ${router.interfaces.wan.ip || 'N/A'})`);
    }
    
    console.log(`[FREE INTERFACES] Όλα τα διαθέσιμα interfaces: ${allInterfaces.join(', ')}`);
    
    // Βρες τα ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΑ interfaces
    const usedInterfaces = this.getActuallyUsedRouterInterfaces(router);
    
    // Φίλτραρε τα ελεύθερα interfaces
    const freeInterfaces = allInterfaces.filter(iface => !usedInterfaces.has(iface));
    
    console.log(`[FREE INTERFACES] ${router.name}: Διαθέσιμα: ${allInterfaces}, Χρησιμοποιημένα: ${Array.from(usedInterfaces)}, Ελεύθερα: ${freeInterfaces}`);
    
    return freeInterfaces;
}
    
    // ==================== ΚΥΡΙΕΣ ΜΕΘΟΔΟΙ ====================

canAcceptConnection(device, requestedInterface = null) {
    console.log('[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Έλεγχος:', device?.name, device?.type, 'Interface:', requestedInterface);

    if (!device) {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ΑΠΟΡΡΙΦΘΗΚΕ: Δεν βρέθηκε η συσκευή.`);
        return false;
    }

    // 1. Switches - απεριόριστες συνδέσεις
    if (device.type === 'switch') {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (switch): Απεριόριστες συνδέσεις ✓`);
        return true;
    }

    // 2. Routers - ΜΕΓΙΣΤΟ 3 ΣΥΝΔΕΣΕΙΣ ΣΥΝΟΛΙΚΑ
    if (device.type === 'router') {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (router): Έλεγχος...`);
        
        // ΜΕΤΡΗΣΕ ΠΡΑΓΜΑΤΙΚΕΣ ΣΥΝΔΕΣΕΙΣ
        const currentConns = this.connections.filter(conn => 
            conn.device1Id === device.id || conn.device2Id === device.id
        ).length;
        
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} έχει ${currentConns} συνδέσεις`);
        
        // ΜΕΓΙΣΤΟ 3 ΣΥΝΔΕΣΕΙΣ ΟΛΟΚΛΗΡΟ
        if (currentConns >= 3) {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name}: Ήδη έχει ${currentConns}/3 συνδέσεις ✗`);
            return false;
        }
        
        // Αν ζητήθηκε συγκεκριμένο interface, έλεγξε αν είναι διαθέσιμο
        if (requestedInterface) {
            const freeInterfaces = this.getFreeRouterInterfaces(device);
            const isAvailable = freeInterfaces.includes(requestedInterface);
            
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Ελεύθερα interfaces: ${freeInterfaces.join(', ')}, Ζητούμενο: ${requestedInterface}, Διαθέσιμο: ${isAvailable}`);
            
            return isAvailable;
        }
        
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} μπορεί να δεχτεί σύνδεση ✓`);
        return true;
    }

    // 3. Firewall - δύο θύρες (inside, outside)
    if (device.type === 'firewall') {
        const used = this.connections.filter(conn => conn.device1Id === device.id || conn.device2Id === device.id).length;
        return used < FIREWALL_PORTS.length;
    }

    // 4. Όλες οι άλλες συσκευές - μόνο 1 σύνδεση
    const currentConns = this.connections.filter(conn => 
        conn.device1Id === device.id || conn.device2Id === device.id
    ).length;

    console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (${device.type}): ${currentConns} συνδέσεις`);

    if (currentConns < 1) {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} μπορεί να δεχτεί σύνδεση ✓`);
        return true;
    } else {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} δεν μπορεί να δεχτεί άλλη σύνδεση ✗`);
        return false;
    }
}
    // ==================== ΜΕΘΟΔΟΣ ΔΗΜΙΟΥΡΓΙΑΣ ROUTER-TO-ROUTER ΣΥΝΔΕΣΗΣ ====================
    
    createRouterToRouterConnection(router1, router2) {
        console.log(`[ROUTER↔ROUTER] Δημιουργία σύνδεσης: ${router1.name} ↔ ${router2.name}`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Μπορούν να δεχτούν σύνδεση;
        const can1 = this.canAcceptConnection(router1);
        const can2 = this.canAcceptConnection(router2);
        
        if (!can1 || !can2) {
            console.log(`[ROUTER↔ROUTER] ΑΠΟΡΡΙΦΘΗΚΕ: Ένας router δεν μπορεί να δεχτεί σύνδεση`);
            if (window.uiManager) {
                window.uiManager.addLog(`Ο router δεν μπορεί να δεχτεί σύνδεση (όχι ελεύθερα interfaces)`, "error");
            }
            return null;
        }
        
        // Έλεγχος για ύπαρξη ήδη σύνδεσης
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === router1.id && conn.device2Id === router2.id) ||
            (conn.device1Id === router2.id && conn.device2Id === router1.id)
        );
        
        if (existingConnection) {
            console.log(`[ROUTER↔ROUTER] Οι routers είναι ήδη συνδεδεμένοι`);
            if (window.uiManager) {
                window.uiManager.addLog(`Οι routers είναι ήδη συνδεδεμένοι`, "warning");
            }
            return existingConnection;
        }
        
        // Λήψη ελεύθερων interfaces ΚΑΙ ΤΩΡΑ ΚΑΝΟΥΜΕ ΑΠΛΟ ΕΛΕΓΧΟ
        const freeInterfaces1 = this.getFreeRouterInterfaces(router1);
        const freeInterfaces2 = this.getFreeRouterInterfaces(router2);
        
        console.log(`[ROUTER↔ROUTER] Ελεύθερα interfaces: ${router1.name}: ${freeInterfaces1}, ${router2.name}: ${freeInterfaces2}`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Υπάρχουν ελεύθερα interfaces;
        if (freeInterfaces1.length === 0) {
            alert(`Ο router ${router1.name} δεν έχει ελεύθερα interfaces!`);
            return null;
        }
        if (freeInterfaces2.length === 0) {
            alert(`Ο router ${router2.name} δεν έχει ελεύθερα interfaces!`);
            return null;
        }
        
        // ΑΠΛΗ ΕΠΙΛΟΓΗ ΧΩΡΙΣ ΠΕΡΙΣΣΕΣ ΛΟΓΙΚΕΣ
        let optionsText = `Σύνδεση Router ↔ Router:\n\n`;
        optionsText += `${router1.name} ↔ ${router2.name}\n\n`;
        optionsText += `Επιλογή interface για ${router1.name}:\n`;
        
        freeInterfaces1.forEach((iface, index) => {
            let ipInfo = '';
            switch(iface) {
                case 'lan': ipInfo = `LAN (${router1.interfaces.lan.ip})`; break;
                case 'lan2': ipInfo = `LAN2 (${router1.interfaces.lan2.ip})`; break;
                case 'wan': ipInfo = `WAN (${router1.interfaces.wan.ip || 'Θα δημιουργηθεί'})`; break;
            }
            optionsText += `${index + 1}. ${iface.toUpperCase()} - ${ipInfo}\n`;
        });
        
        optionsText += `\nΕισάγετε αριθμό (1-${freeInterfaces1.length}):`;
        
        const interfaceChoice = prompt(optionsText, "1");
        const choiceIndex = parseInt(interfaceChoice) - 1;
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Επιλογή χρήστη
        if (choiceIndex >= 0 && choiceIndex < freeInterfaces1.length) {
            const interface1 = freeInterfaces1[choiceIndex];
            
            // Τώρα επιλογή για τον δεύτερο router
            let optionsText2 = `Επιλογή interface για ${router2.name}:\n\n`;
            
            freeInterfaces2.forEach((iface, index) => {
                let ipInfo = '';
                switch(iface) {
                    case 'lan': ipInfo = `LAN (${router2.interfaces.lan.ip})`; break;
                    case 'lan2': ipInfo = `LAN2 (${router2.interfaces.lan2.ip})`; break;
                    case 'wan': ipInfo = `WAN (${router2.interfaces.wan.ip || 'Θα δημιουργηθεί'})`; break;
                }
                optionsText2 += `${index + 1}. ${iface.toUpperCase()} - ${ipInfo}\n`;
            });
            
            optionsText2 += `\nΕισάγετε αριθμό (1-${freeInterfaces2.length}):`;
            
            const interfaceChoice2 = prompt(optionsText2, "1");
            const choiceIndex2 = parseInt(interfaceChoice2) - 1;
            
            if (choiceIndex2 >= 0 && choiceIndex2 < freeInterfaces2.length) {
                const interface2 = freeInterfaces2[choiceIndex2];
                
                console.log(`[ROUTER↔ROUTER] Επιλέχθηκαν: ${router1.name}(${interface1}) ↔ ${router2.name}(${interface2})`);
                
                // ΚΑΝΟΥΜΕ ΤΗΝ ΣΥΝΔΕΣΗ ΚΑΙ ΑΝ ΕΙΝΑΙ ΛΑΝ ↔ ΛΑΝ ΜΕ ΗΔΗ CLOUD ΣΤΟ WAN
                // ΑΛΛΑ ΑΦΗΝΟΥΜΕ ΤΟΝ ΧΡΗΣΤΗ ΝΑ ΑΠΟΦΑΣΙΣΕΙ
                return this.createRouterToRouterConnectionWithInterfaces(router1, router2, interface1, interface2);
            }
        }
        
        console.log(`[ROUTER↔ROUTER] Ακυρη επιλογή. Ακύρωση.`);
        return null;
    }
    
    // ΔΙΟΡΘΩΜΕΝΗ ΜΕΘΟΔΟΣ: Κάνει ακριβώς αυτό που ζητάει ο χρήστης
    createRouterToRouterConnectionWithInterfaces(router1, router2, interface1, interface2) {
        console.log(`[ROUTER↔ROUTER] Δημιουργία: ${router1.name}(${interface1}) ↔ ${router2.name}(${interface2})`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Μπορούν να δεχτούν σύνδεση στα συγκεκριμένα interfaces;
        const can1 = this.canAcceptConnection(router1, interface1);
        const can2 = this.canAcceptConnection(router2, interface2);
        
        if (!can1 || !can2) {
            console.log(`[ROUTER↔ROUTER] Απόρριψη: Το interface δεν είναι διαθέσιμο`);
            alert(`Το ${interface1.toUpperCase()} του ${router1.name} ή το ${interface2.toUpperCase()} του ${router2.name} δεν είναι διαθέσιμο!`);
            return null;
        }
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: WAN που έχει ήδη Cloud
        if (interface1 === 'wan') {
            const hasCloudOnWAN1 = this.doesRouterHaveDeviceOnInterface(router1, 'wan', 'cloud');
            if (hasCloudOnWAN1) {
                const choice = confirm(`Ο ${router1.name} έχει ήδη Cloud στο WAN!\n\nΘέλετε να συνεχίσετε με αυτή τη σύνδεση;`);
                if (!choice) return null;
            }
        }
        
        if (interface2 === 'wan') {
            const hasCloudOnWAN2 = this.doesRouterHaveDeviceOnInterface(router2, 'wan', 'cloud');
            if (hasCloudOnWAN2) {
                const choice = confirm(`Ο ${router2.name} έχει ήδη Cloud στο WAN!\n\nΘέλετε να συνεχίσετε με αυτή τη σύνδεση;`);
                if (!choice) return null;
            }
        }
        
        // ΑΠΛΗ ΔΗΜΙΟΥΡΓΙΑ ΣΥΝΔΕΣΗΣ
        const connection = this.createBasicConnection(router1, router2);
        
        if (connection) {
            // ΑΠΛΗ ΑΠΟΘΗΚΕΥΣΗ
            if (!router1.connectionInterfaces) router1.connectionInterfaces = {};
            if (!router2.connectionInterfaces) router2.connectionInterfaces = {};
            
            router1.connectionInterfaces[connection.id] = interface1;
            router2.connectionInterfaces[connection.id] = interface2;
            
            connection.interface1 = interface1;
            connection.interface2 = interface2;
            this.refreshConnectionStatus(connection);
            
            console.log(`[ROUTER↔ROUTER] Δημιουργήθηκε: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
            
            // ΑΝΑΘΕΣΗ IP ΜΟΝΟ ΑΝ ΧΡΕΙΑΖΕΤΑΙ
            if (interface1 === 'wan' && (!router1.interfaces.wan.ip || router1.interfaces.wan.ip === 'N/A')) {
                this.assignRouterWanIP(router1, router2);
            }
            if (interface2 === 'wan' && (!router2.interfaces.wan.ip || router2.interfaces.wan.ip === 'N/A')) {
                this.assignRouterWanIP(router2, router1);
            }
            
            // ΠΡΟΣΘΗΚΗ ROUTES ΑΠΛΑ
            this.addSimpleRoutesForRouterConnection(router1, router2, interface1, interface2);
            
            if (window.uiManager) {
                window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`, 'success');
            }
        }
        
        return connection;
    }
    
    // ΝΕΑ ΒΟΗΘΗΤΙΚΗ: Έλεγχος αν router έχει συγκεκριμένη συσκευή σε interface
    doesRouterHaveDeviceOnInterface(router, interfaceType, deviceType) {
        if (!router.connectionInterfaces) return false;
        
        for (const [connId, iface] of Object.entries(router.connectionInterfaces)) {
            if (iface === interfaceType) {
                const conn = this.connections.find(c => c.id === connId);
                if (conn) {
                    const otherId = conn.device1Id === router.id ? conn.device2Id : conn.device1Id;
                    const otherDevice = window.deviceManager.getDeviceById(otherId);
                    if (otherDevice && otherDevice.type === deviceType) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    // Router ↔ router: routes και για τις δύο πλευρές, με σωστό next hop (τη διεύθυνση του γείτονα).
    addSimpleRoutesForRouterConnection(router1, router2) {
        this.autoGenerateRoutesForRouter(router1);
        this.autoGenerateRoutesForRouter(router2);
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΔΗΜΙΟΥΡΓΙΑΣ ΣΥΝΔΕΣΕΩΝ ====================
    
    // Βασική μέθοδος δημιουργίας σύνδεσης
    createBasicConnection(device1, device2) {
        console.log(`[BASIC CONNECTION] Δημιουργία: ${device1.name} ↔ ${device2.name}`);
        
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[BASIC CONNECTION] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            if (window.uiManager) {
                window.uiManager.addLog(`Σφάλμα: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`, "error");
            }
            return null;
        }
        
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        if (existingConnection) {
            console.log(`[BASIC CONNECTION] Οι συσκευές είναι ήδη συνδεδεμένες`);
            if (window.uiManager) {
                window.uiManager.addLog(`Οι συσκευές είναι ήδη συνδεδεμένες`, "warning");
            }
            return existingConnection;
        }
        
        const connection = {
            id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct',
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        this.connections.push(connection);
        
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connection.id);
        device2.connections.push(connection.id);
        
        if (device1.type === 'firewall') this.assignFirewallPort(device1, connection, device2);
        if (device2.type === 'firewall') this.assignFirewallPort(device2, connection, device1);
        this.refreshConnectionStatus(connection);
        
        console.log(`[BASIC CONNECTION] Δημιουργήθηκε: ${device1.name} ↔ ${device2.name} (${connection.canCommunicate ? 'ΕΠΙΚΟΙΝΩΝΙΑ ΔΥΝΑΤΗ' : 'ΧΩΡΙΣ ΕΠΙΚΟΙΝΩΝΙΑ'})`);
        
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }

createConnection(device1, device2) {
    console.log(`[ΣΥΝΔΕΣΗ] Έλεγχος: ${device1.name} (${device1.type}) ↔ ${device2.name} (${device2.type})`);
    
    // 1. Router ↔ Router
    if (device1.type === 'router' && device2.type === 'router') {
        return this.createRouterToRouterConnection(device1, device2);
    }
    
    // 2. Router ↔ Όποια άλλη συσκευή (Cloud, Server, Computer, κλπ.)
    if ((device1.type === 'router' && device2.type !== 'router') || 
        (device2.type === 'router' && device1.type !== 'router')) {
        
        // Βοήθεια: Βρείτε ποιος είναι ο router
        const router = device1.type === 'router' ? device1 : device2;
        const otherDevice = device1.type === 'router' ? device2 : device1;
        
        console.log(`[ROUTER-DEVICE] Σύνδεση: ${router.name} ↔ ${otherDevice.name} (${otherDevice.type})`);
        return this.createRouterToDeviceConnection(router, otherDevice);
    }
    
    // 3. Οι υπόλοιπες συνδέσεις (χωρίς router)
    return this.createBasicConnection(device1, device2);
}
    
    // Σύνδεση Router ↔ Όποια άλλη συσκευή
createRouterToDeviceConnection(router, otherDevice) {
    console.log(`[ROUTER-DEVICE] Δημιουργία σύνδεσης: ${router.name} ↔ ${otherDevice.name}`);
    
    // Έλεγχος αν μπορούν να δεχτούν σύνδεση
    const can1 = this.canAcceptConnection(router);
    const can2 = this.canAcceptConnection(otherDevice);
    
    if (!can1 || !can2) {
        console.log(`[ROUTER-DEVICE] ΑΠΟΡΡΙΦΘΗΚΕ: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
        if (window.uiManager) {
            window.uiManager.addLog(`Σφάλμα: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`, "error");
        }
        return null;
    }
    
    // Έλεγχος για ύπαρξη σύνδεσης
    const existingConnection = this.connections.find(conn => 
        (conn.device1Id === router.id && conn.device2Id === otherDevice.id) ||
        (conn.device1Id === otherDevice.id && conn.device2Id === router.id)
    );
    
    if (existingConnection) {
        console.log(`[ROUTER-DEVICE] Οι συσκευές είναι ήδη συνδεδεμένες`);
        if (window.uiManager) {
            window.uiManager.addLog(`Οι συσκευές είναι ήδη συνδεδεμένες`, "warning");
        }
        return existingConnection;
    }
    
    // Βρες τα ελεύθερα interfaces του router
    const freeInterfaces = this.getFreeRouterInterfaces(router);
    
    console.log(`[ROUTER-DEVICE] Router ${router.name}: Ελεύθερα interfaces: ${freeInterfaces.join(', ')}`);
    
    if (freeInterfaces.length === 0) {
        alert(`Ο router ${router.name} δεν έχει ελεύθερα interfaces!`);
        console.log(`[ROUTER-DEVICE] Router ${router.name} δεν έχει ελεύθερα interfaces`);
        return null;
    }
    
    // ΑΠΛΗ ΕΠΙΛΟΓΗ
    let optionsText = `Σύνδεση ${router.name} (Router) ↔ ${otherDevice.name} (${otherDevice.type}):\n\n`;
    optionsText += `Επιλογή interface για τον router ${router.name}:\n\n`;
    
    // Ειδική περίπτωση για switch χωρίς IP
    if (otherDevice.type === 'switch' && (!otherDevice.ip || otherDevice.ip === 'N/A')) {
        optionsText += "ΣΗΜΕΙΩΣΗ: Το switch δεν έχει IP - θα συνδεθεί μόνο στο LAN ή LAN2\n\n";
        
        // Φιλτράρουμε μόνο LAN και LAN2 για switches χωρίς IP
        const availableInterfaces = freeInterfaces.filter(iface => iface === 'lan' || iface === 'lan2');
        if (availableInterfaces.length === 0) {
            alert(`Ο router ${router.name} δεν έχει διαθέσιμο LAN ή LAN2 για switch χωρίς IP!`);
            return null;
        }
        
        availableInterfaces.forEach((iface, index) => {
            let info = '';
            switch(iface) {
                case 'lan':
                    info = `LAN (${router.interfaces.lan.ip}/24)`;
                    break;
                case 'lan2':
                    info = `LAN2 (${router.interfaces.lan2.ip}/24)`;
                    break;
            }
            optionsText += `${index + 1}. ${iface.toUpperCase()} - ${info}\n`;
        });
        
        optionsText += `\nΕισάγετε αριθμό (1-${availableInterfaces.length}):`;
        
        const interfaceChoice = prompt(optionsText, "1");
        const choiceIndex = parseInt(interfaceChoice) - 1;
        
        let selectedInterface = null;
        
        if (choiceIndex >= 0 && choiceIndex < availableInterfaces.length) {
            selectedInterface = availableInterfaces[choiceIndex];
        } else {
            selectedInterface = availableInterfaces[0] || 'lan';
        }
        
        console.log(`[ROUTER-DEVICE] Θα δημιουργηθεί σύνδεση με interface: ${selectedInterface}`);
        
        // Δημιουργία της σύνδεσης
        return this.createRouterToDeviceConnectionWithInterface(router, otherDevice, selectedInterface);
    }
    
    // Κανονική περίπτωση (όχι switch χωρίς IP)
    freeInterfaces.forEach((iface, index) => {
        let info = '';
        switch(iface) {
            case 'lan':
                info = `LAN (${router.interfaces.lan.ip}/24)`;
                break;
            case 'lan2':
                info = `LAN2 (${router.interfaces.lan2.ip}/24)`;
                break;
            case 'wan':
                info = `WAN (${router.interfaces.wan.ip || 'Θα δημιουργηθεί IP'})`;
                break;
        }
        optionsText += `${index + 1}. ${iface.toUpperCase()} - ${info}\n`;
    });
    
    optionsText += `\nΕισάγετε αριθμό (1-${freeInterfaces.length}):`;
    
    const interfaceChoice = prompt(optionsText, "1");
    const choiceIndex = parseInt(interfaceChoice) - 1;
    
    let selectedInterface = null;
    
    if (choiceIndex >= 0 && choiceIndex < freeInterfaces.length) {
        selectedInterface = freeInterfaces[choiceIndex];
    } else {
        selectedInterface = freeInterfaces[0] || 'lan';
    }
    
    console.log(`[ROUTER-DEVICE] Θα δημιουργηθεί σύνδεση με interface: ${selectedInterface}`);
    
    // Δημιουργία της σύνδεσης
    return this.createRouterToDeviceConnectionWithInterface(router, otherDevice, selectedInterface);
}

// Σύνδεση με συγκεκριμένο interface
createRouterToDeviceConnectionWithInterface(router, otherDevice, interfaceType) {
    console.log(`[ROUTER-DEVICE] Δημιουργία σύνδεσης με interface: ${interfaceType}`);
    
    // ΕΛΕΓΧΟΣ: Μπορεί ο router να δεχτεί σύνδεση στο συγκεκριμένο interface;
    const canConnect = this.canAcceptConnection(router, interfaceType);
    const canOtherConnect = this.canAcceptConnection(otherDevice);
    
    if (!canConnect || !canOtherConnect) {
        alert(`Το ${interfaceType.toUpperCase()} interface του ${router.name} δεν είναι διαθέσιμο!`);
        return null;
    }
    
    // Δημιουργία βασικής σύνδεσης
    const connection = this.createBasicConnection(router, otherDevice);
    
    if (connection) {
        // Αποθήκευση πληροφορίας interface
        if (!router.connectionInterfaces) router.connectionInterfaces = {};
        router.connectionInterfaces[connection.id] = interfaceType;
        
        // Αποθήκευση στο connection object
        if (connection.device1Id === router.id) {
            connection.interface1 = interfaceType;
        } else {
            connection.interface2 = interfaceType;
        }
        
        console.log(`[ROUTER-DEVICE] Δημιουργήθηκε: ${router.name} (${interfaceType}) ↔ ${otherDevice.name}`);
        
        // ΑΠΛΗ ΔΙΟΡΘΩΣΗ: Αποθήκευση interface ΓΙΑ SWITCH ΧΩΡΙΣ IP
        if (otherDevice.type === 'switch' && (!otherDevice.ip || otherDevice.ip === 'N/A')) {
            console.log(`[SWITCH NO IP] Αποθήκευση interface: ${interfaceType} για switch ${otherDevice.name}`);
            // Απλή αποθήκευση στο switch
            otherDevice.connectedToInterface = interfaceType;
        }
        
        // Ειδική περίπτωση: Cloud στο WAN
        if (interfaceType === 'wan' && otherDevice.type === 'cloud') {
            if (!router.interfaces.wan.ip || router.interfaces.wan.ip === 'N/A') {
                this.assignRouterWanIPForCloud(router, otherDevice);
            }
        }
        
        // Ενημέρωση IP της συσκευής αν χρειάζεται
        this.updateDeviceIPForRouterInterface(otherDevice, router, interfaceType);
        this.refreshConnectionStatus(connection);
        
        // Ενημέρωση UI
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${router.name} (${interfaceType}) ↔ ${otherDevice.name}`, 'success');
        }
    }
    
    return connection;
}

// Ανάθεση WAN IP για Cloud
assignRouterWanIPForCloud(router, cloudDevice) {
    console.log(`[ROUTER WAN] Ανάθεση WAN IP για ${router.name} που συνδέεται με Cloud`);
    
    const cloudIP = cloudDevice.ip;
    
    if (cloudIP && cloudIP !== 'N/A' && cloudIP !== '0.0.0.0') {
        const ipParts = cloudIP.split('.');
        
        for (let i = 2; i < 254; i++) {
            ipParts[3] = i.toString();
            const potentialIP = ipParts.join('.');
            
            const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
            if (!existingDevice || existingDevice.id === router.id) {
                router.interfaces.wan.ip = potentialIP;
                router.interfaces.wan.subnetMask = '255.255.255.0';
                router.interfaces.wan.gateway = cloudIP;
                
                console.log(`[ROUTER WAN] Ορίστηκε WAN IP: ${potentialIP}, Gateway: ${cloudIP}`);
                
                if (router.element && router.element.querySelector('.device-ip')) {
                    router.element.querySelector('.device-ip').innerHTML = 
                        `WAN: ${potentialIP}<br>LAN: ${router.interfaces.lan.ip}`;
                }
                
                return potentialIP;
            }
        }
    }
    
    router.interfaces.wan.ip = '192.168.1.6';
    router.interfaces.wan.subnetMask = '255.255.255.0';
    router.interfaces.wan.gateway = '192.168.1.1';
    
    console.log(`[ROUTER WAN] Fallback WAN IP: 192.168.1.6`);
    return '192.168.1.6';
}

// Host χωρίς IP που συνδέεται σε διεπαφή router παίρνει ελεύθερη διεύθυνση στο δίκτυό της.
// Τα switches μένουν unmanaged (χωρίς IP) και οι routers έχουν τις δικές τους διεπαφές.
updateDeviceIPForRouterInterface(device, router, interfaceType) {
        if (device.type === 'switch' || device.type === 'router') return;
        if (isValidIP(device.ip) && device.ip !== '0.0.0.0') return;

        const iface = router.interfaces[interfaceType];
        if (!iface || iface.enabled === false || !isValidIP(iface.ip)) return;
        const ip = window.deviceManager.allocateHostIP(iface.ip, iface.subnetMask);
        if (!ip) return;

        const upstream = interfaceType === 'wan' && isValidIP(iface.gateway) && iface.gateway !== '0.0.0.0';
        Object.assign(device, { ip, subnetMask: iface.subnetMask, gateway: upstream ? iface.gateway : iface.ip });

        const label = device.element?.querySelector('.device-ip');
        if (label) {
            label.textContent = ip;
            label.className = 'device-ip';
        }
    }



    createConnectionWithId(device1, device2, connectionId) {
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργία με προκαθορισμένο ID: ${connectionId}`);
        
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[ΣΥΝΔΕΣΗ] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            return null;
        }
        
        const existingConnection = this.connections.find(conn => conn.id === connectionId);
        if (existingConnection) {
            console.log(`[ΣΥΝΔΕΣΗ] Σύνδεση με ID ${connectionId} υπάρχει ήδη`);
            return existingConnection;
        }
        
        const connection = {
            id: connectionId,
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct',
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        this.connections.push(connection);
        
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connectionId);
        device2.connections.push(connectionId);
        
        this.refreshConnectionStatus(connection);
        
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργήθηκε με ID: ${connectionId}`);
        
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΑΦΑΙΡΕΣΗΣ ΣΥΝΔΕΣΕΩΝ ====================
    
    removeDuplicateConnections() {
        console.log('[CLEANUP] Απομάκρυνση διπλότυπων συνδέσεων...');
        
        const uniqueConnections = [];
        const seenPairs = new Set();
        const duplicatesRemoved = [];
        
        this.connections.forEach(connection => {
            const pairKey = [connection.device1Id, connection.device2Id].sort().join('|');
            
            if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                uniqueConnections.push(connection);
            } else {
                duplicatesRemoved.push(connection.id);
                
                const device1 = window.deviceManager?.getDeviceById(connection.device1Id);
                const device2 = window.deviceManager?.getDeviceById(connection.device2Id);
                
                if (device1 && device1.connections) {
                    const index = device1.connections.indexOf(connection.id);
                    if (index !== -1) device1.connections.splice(index, 1);
                }
                
                if (device2 && device2.connections) {
                    const index = device2.connections.indexOf(connection.id);
                    if (index !== -1) device2.connections.splice(index, 1);
                }
            }
        });
        
        this.connections = uniqueConnections;
        
        console.log(`[CLEANUP] Αφαιρέθηκαν ${duplicatesRemoved.length} διπλότυπες συνδέσεις:`, duplicatesRemoved);
        return duplicatesRemoved;
    }
    
removeConnection(connection) {
    console.log(`[CONNECTION] Διαγραφή σύνδεσης: ${connection.id}`);
    
    const device1 = window.deviceManager.getDeviceById(connection.device1Id);
    const device2 = window.deviceManager.getDeviceById(connection.device2Id);
    
    // 1. Αφαίρεση από arrays συνδέσεων συσκευών
    if (device1 && device1.connections) {
        const index1 = device1.connections.indexOf(connection.id);
        if (index1 !== -1) {
            device1.connections.splice(index1, 1);
            console.log(`[CONNECTION] Αφαιρέθηκε από ${device1.name} connections`);
        }
    }
    
    if (device2 && device2.connections) {
        const index2 = device2.connections.indexOf(connection.id);
        if (index2 !== -1) {
            device2.connections.splice(index2, 1);
            console.log(`[CONNECTION] Αφαιρέθηκε από ${device2.name} connections`);
        }
    }
    
    // 2. ΑΦΑΙΡΕΣΗ ΑΠΟ CONNECTIONINTERFACES (ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΚΕΥΦΑΛΙΚΟ!)
    if (device1 && device1.connectionInterfaces) {
        if (device1.connectionInterfaces[connection.id]) {
            console.log(`[CONNECTION] Διαγραφή interface από ${device1.name}: ${device1.connectionInterfaces[connection.id]}`);
            delete device1.connectionInterfaces[connection.id];
        } else {
            console.log(`[CONNECTION] ${device1.name}: Δεν υπήρχε interface για ${connection.id}`);
        }
    }
    
    if (device2 && device2.connectionInterfaces) {
        if (device2.connectionInterfaces[connection.id]) {
            console.log(`[CONNECTION] Διαγραφή interface από ${device2.name}: ${device2.connectionInterfaces[connection.id]}`);
            delete device2.connectionInterfaces[connection.id];
        } else {
            console.log(`[CONNECTION] ${device2.name}: Δεν υπήρχε interface για ${connection.id}`);
        }
    }
    
    // 3. Αφαίρεση από το DOM
    const connEl = document.getElementById(connection.id);
    if (connEl) {
        connEl.remove();
        console.log(`[CONNECTION] Αφαιρέθηκε από DOM: ${connection.id}`);
    }
    
    // 4. Αφαίρεση από τη λίστα συνδέσεων
    const connIndex = this.connections.indexOf(connection);
    if (connIndex !== -1) {
        this.connections.splice(connIndex, 1);
        console.log(`[CONNECTION] Αφαιρέθηκε από connections array`);
    }
    
    console.log(`[CONNECTION] Σύνδεση διαγράφηκε επιτυχώς: ${connection.id}`);
    
    return connection;
}
    // ==================== ΜΕΘΟΔΟΙ ΕΝΗΜΕΡΩΣΗΣ ΚΑΙ ΟΠΤΙΚΟΠΟΙΗΣΗΣ ====================
    
    updateAllConnections(devices) {
        devices.forEach(device => { device.connections ??= []; });
        this.connections.forEach(connection => this.refreshConnectionStatus(connection));
        this.updateConnectionsVisual();
    }
    
    updateConnectionsVisual() {
        document.querySelectorAll('.connection').forEach(el => el.remove());
        
        this.connections.forEach(conn => {
            const device1 = window.deviceManager.getDeviceById(conn.device1Id);
            const device2 = window.deviceManager.getDeviceById(conn.device2Id);
            
            if (!device1 || !device2) return;
            
            const x1 = device1.x + 60;
            const y1 = device1.y + 60;
            const x2 = device2.x + 60;
            const y2 = device2.y + 60;
            
            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            const isSwitch = (device) => device.type === 'switch';
            
            let colorClass;
            if (!conn.canCommunicate && !(isSwitch(device1) || isSwitch(device2))) {
                colorClass = 'invalid-connection';
            } else if (conn.type === 'routed') {
                colorClass = 'routed-connection';
            } else {
                colorClass = 'valid-connection';
            }
            
            const connectionEl = document.createElement('div');
            connectionEl.className = `connection ${colorClass}`;
            connectionEl.id = conn.id;
            connectionEl.style.width = `${length}px`;
            connectionEl.style.left = `${x1}px`;
            connectionEl.style.top = `${y1}px`;
            connectionEl.style.transform = `rotate(${angle}deg)`;
            
            document.getElementById('workspace').appendChild(connectionEl);
        });
    }    
    
    // ==================== ΜΕΘΟΔΟΙ ΕΠΙΚΟΙΝΩΝΙΑΣ ====================
    
    // Μπορούν δύο συσκευές να ανταλλάξουν ping (request ΚΑΙ reply);
    // Το όνομα και το σχήμα επιστροφής μένουν ίδια για τους υπάρχοντες callers.
    canDevicesCommunicateDirectly(device1, device2, options = {}) {
        if (device1.id === device2.id) {
            return { canCommunicate: true, viaGateway: false, path: [device1] };
        }

        // Unmanaged switch: δεν έχει IP, άρα μόνο φυσική (L2) σύνδεση
        if (getL3Interfaces(device1).length === 0 || getL3Interfaces(device2).length === 0) {
            const linked = this.findPathBetweenDevices(device1, device2) !== null;
            const isUnmanagedSwitch = d => d.type === 'switch' && getL3Interfaces(d).length === 0;
            const canCommunicate = linked && (isUnmanagedSwitch(device1) || isUnmanagedSwitch(device2));
            return { canCommunicate, viaGateway: false, path: null, reason: canCommunicate ? null : 'no-ip' };
        }

        const result = ping(this.topology(), device1, device2, options);
        const viaGateway = result.ok &&
            result.path.some(d => d.type === 'router' && d !== device1 && d !== device2);

        return {
            canCommunicate: result.ok,
            viaGateway,
            path: result.ok ? result.path : null,
            sourceIP: result.sourceIP,
            targetIP: result.targetIP,
            reason: result.ok ? null : result.reason,
            detail: result.detail ?? null,
            failedAt: result.at ?? null
        };
    }
    

    

    

    

    

    
    // ==================== ΒΟΗΘΗΤΙΚΕΣ ΜΕΘΟΔΟΙ ΓΙΑ ΣΥΝΔΕΣΕΙΣ ====================
    
    areDevicesConnected(device1, device2) {
        if (!device1.connections || !device2.connections) {
            console.log(`[ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΣΥΝΔΕΣΗΣ] Λείπουν array συνδέσεων για ${device1.name} ή ${device2.name}`);
            return false;
        }
        
        const isConnected = this.connections.some(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        console.log(`[ΣΥΝΔΕΔΕΜΕΝΕΣ] ${device1.name} ↔ ${device2.name}: ${isConnected}`);
        return isConnected;
    }
    

    
    getConnectedDevices(device) {
        const connected = [];
        
        if (!device.connections) {
            console.log(`[ΛΗΨΗ ΣΥΝΔΕΣΕΩΝ] Δεν υπάρχει array συνδέσεων για ${device.name}`);
            return connected;
        }
        
        device.connections.forEach(connId => {
            const conn = this.connections.find(c => c.id === connId);
            if (conn) {
                const otherId = conn.device1Id === device.id ? conn.device2Id : conn.device1Id;
                const otherDevice = window.deviceManager.getDeviceById(otherId);
                if (otherDevice) {
                    connected.push(otherDevice);
                }
            }
        });
        
        console.log(`[ΣΥΝΔΕΔΕΜΕΝΕΣ ΣΥΣΚΕΥΕΣ] ${device.name}: ${connected.map(d => d.name).join(', ')}`);
        return connected;
    }
    
    findPathBetweenDevices(device1, device2) {
        if (device1.id === device2.id) return [device1];
        
        console.log(`[ΔΙΑΔΡΟΜΗ] Εύρεση διαδρομής: ${device1.name} → ${device2.name}`);
        
        if (this.areDevicesConnected(device1, device2)) {
            console.log(`[ΔΙΑΔΡΟΜΗ] Βρέθηκε άμεση σύνδεση`);
            return [device1, device2];
        }
        
        const visited = new Set();
        const queue = [{ device: device1, path: [device1] }];
        visited.add(device1.id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            const connectedDevices = this.getConnectedDevices(current.device);
            
            console.log(`[ΔΙΑΔΡΟΜΗ] Τρέχουσα: ${current.device.name}, Συνδεδεμένες: ${connectedDevices.map(d => d.name).join(', ')}`);
            
            for (const neighbor of connectedDevices) {
                if (visited.has(neighbor.id)) continue;
                
                visited.add(neighbor.id);
                const newPath = [...current.path, neighbor];
                
                if (neighbor.id === device2.id) {
                    console.log(`[ΔΙΑΔΡΟΜΗ] Βρέθηκε διαδρομή: ${newPath.map(d => d.name).join(' → ')}`);
                    return newPath;
                }
                
                queue.push({ device: neighbor, path: newPath });
            }
        }
        
        console.log(`[ΔΙΑΔΡΟΜΗ] ΔΕΝ ΒΡΕΘΗΚΕ διαδρομή από ${device1.name} προς ${device2.name}`);
        return null;
    }
    
    canDevicesCommunicateWithPath(device1, device2, options = {}) {
        return this.canDevicesCommunicateDirectly(device1, device2, options);
    }

    // Θύρα firewall (inside/outside) για νέα σύνδεση. Αν είναι ελεύθερες και οι δύο, ρωτά τον χρήστη.
    assignFirewallPort(firewall, connection, otherDevice) {
        firewall.connectionInterfaces ??= {};
        const used = Object.values(firewall.connectionInterfaces);
        const free = FIREWALL_PORTS.filter(port => !used.includes(port));
        let port = free[0];
        if (free.length > 1) {
            const choice = prompt(
                `Θύρα του ${firewall.name} για τη σύνδεση με ${otherDevice.name}:\n\n` +
                `1. Inside (εσωτερικό, προστατευόμενο δίκτυο)\n2. Outside (εξωτερικό δίκτυο)`, '1');
            port = choice === '2' ? 'outside' : 'inside';
        }
        firewall.connectionInterfaces[connection.id] = port;
        connection[connection.device1Id === firewall.id ? 'interface1' : 'interface2'] = port;
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΗ ΜΕΘΟΔΟΣ: ΕΥΡΕΣΗ INTERFACE ΓΙΑ ΣΥΣΚΕΥΗ ====================
    
    determineCorrectRouterInterface(router, connectedDevice) {
        console.log(`[INTERFACE DETECT] Έλεγχος interface για: ${router.name}, Συνδεδεμένο: ${connectedDevice.name}`);
        
        // 1. Βρες τη σύνδεση μεταξύ τους
        const connection = this.connections.find(conn => 
            (conn.device1Id === router.id && conn.device2Id === connectedDevice.id) ||
            (conn.device1Id === connectedDevice.id && conn.device2Id === router.id)
        );
        
        if (connection) {
            // 2. Έλεγχος αν το interface είναι ήδη αποθηκευμένο στη σύνδεση
            if (connection.interface1 && connection.device1Id === router.id) {
                console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface1}`);
                return connection.interface1;
            }
            if (connection.interface2 && connection.device2Id === router.id) {
                console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface2}`);
                return connection.interface2;
            }
            
            // 3. Έλεγχος στο router.connectionInterfaces
            if (router.connectionInterfaces && router.connectionInterfaces[connection.id]) {
                const storedInterface = router.connectionInterfaces[connection.id];
                console.log(`[INTERFACE DETECT] Βρέθηκε στο connectionInterfaces: ${storedInterface}`);
                return storedInterface;
            }
        }
        
        // 4. ΕΙΔΙΚΗ ΠΕΡΙΠΤΩΣΗ: Switch χωρίς IP - χρησιμοποίησε το αποθηκευμένο
        if (connectedDevice.type === 'switch' && (!connectedDevice.ip || connectedDevice.ip === 'N/A')) {
            if (connectedDevice.connectedToInterface) {
                console.log(`[INTERFACE DETECT] Switch χωρίς IP έχει αποθηκευμένο: ${connectedDevice.connectedToInterface}`);
                return connectedDevice.connectedToInterface;
            }
            console.log(`[INTERFACE DETECT] Switch χωρίς IP, προεπιλογή: lan`);
            return 'lan';
        }
        
        // 5. Έλεγχος για routers
        if (connectedDevice.type === 'router') {
            console.log(`[INTERFACE DETECT] Router-to-router σύνδεση`);
            return this.getInterfaceForRouterConnection(router, connectedDevice);
        }
        
        // 6. Για άλλες συσκευές, ελέγχουμε αν είναι στο ίδιο δίκτυο
        const routerLanIP = router.interfaces.lan.ip;
        const routerSubnet = router.interfaces.lan.subnetMask;
        const otherIP = this.getDeviceIP(connectedDevice);
        const otherSubnet = this.getDeviceSubnet(connectedDevice);
        
        console.log(`[INTERFACE DETECT] Router LAN: ${routerLanIP}/${routerSubnet}, Other: ${otherIP}/${otherSubnet}`);
        
        if (routerLanIP && routerLanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerLanIP, otherIP, routerSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο -> LAN interface`);
                return 'lan';
            }
        }
        
        // 7. Έλεγχος για WAN
        const routerWanIP = router.interfaces.wan.ip;
        const routerWanSubnet = router.interfaces.wan.subnetMask;
        
        if (routerWanIP && routerWanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerWanIP, otherIP, routerWanSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο WAN -> WAN interface`);
                return 'wan';
            }
        }
        
        // 8. Ελέγχουμε για LAN2
        if (router.interfaces.lan2 && router.interfaces.lan2.enabled) {
            const routerLan2IP = router.interfaces.lan2.ip;
            const routerLan2Subnet = router.interfaces.lan2.subnetMask;
            
            if (routerLan2IP && routerLan2IP !== 'N/A' && otherIP && otherIP !== 'N/A') {
                if (areInSameNetwork(routerLan2IP, otherIP, routerLan2Subnet, otherSubnet)) {
                    console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο LAN2 -> LAN2 interface`);
                    return 'lan2';
                }
            }
        }
        
        console.log(`[INTERFACE DETECT] Δεν μπορούσαμε να προσδιορίσουμε, default: lan`);
        return 'lan'; // default
    }
    
    removeDevice(device) {
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            this.removeConnectionById(connId);
        });
        
        return device;
    }
    
    clearAllConnections() {
        const connectionsCopy = [...this.connections];
        connectionsCopy.forEach(connection => {
            this.removeConnection(connection);
        });
        
        this.connections = [];
        this.packets = [];
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΓΙΑ ROUTING ====================
    

    


    // Αυτόματος πίνακας δρομολόγησης:
    //  - connected route για κάθε ενεργή διεπαφή (LAN, LAN2, WAN)
    //  - route προς τα δίκτυα κάθε γειτονικού router, με next hop τη διεύθυνσή του στο κοινό segment
    //  - default route μέσω του WAN gateway, μόνο αν το gateway είναι on-link στο WAN
    // Επιστρέφει πίνακα με τα routes που προστέθηκαν (όπως περιμένει το main.js).
    autoGenerateRoutesForRouter(router) {
        router.routingTable ??= [];
        const added = [];
        const add = route => {
            if (!this.routeExists(router.routingTable, route)) {
                router.routingTable.push(route);
                added.push(route);
            }
        };

        const ownInterfaces = getL3Interfaces(router);
        const ownNetworks = new Set(ownInterfaces.map(i => `${getNetworkAddress(i.ip, i.mask)}/${i.mask}`));
        const topology = this.topology();

        for (const iface of ownInterfaces) {
            add({ network: getNetworkAddress(iface.ip, iface.mask), mask: iface.mask, gateway: '0.0.0.0', interface: iface.name, metric: 0 });

            getSegmentEndpoints(topology, router, iface.name)
                .filter(endpoint => endpoint.device.type === 'router')
                .forEach(neighbor => {
                    getL3Interfaces(neighbor.device).forEach(remote => {
                        const network = getNetworkAddress(remote.ip, remote.mask);
                        if (ownNetworks.has(`${network}/${remote.mask}`)) return;
                        add({ network, mask: remote.mask, gateway: neighbor.iface.ip, interface: iface.name, metric: 1 });
                    });
                });
        }

        const wan = router.interfaces?.wan;
        if (wan && isOnLink(wan.gateway, wan.ip, wan.subnetMask)) {
            add({ network: '0.0.0.0', mask: '0.0.0.0', gateway: wan.gateway, interface: 'wan', metric: 10 });
        }
        return added;
    }

    // Στιγμιότυπο τοπολογίας για τις συναρτήσεις του routing.js
    topology() {
        return buildTopology(window.deviceManager.devices, this.connections);
    }

    // Υπολογισμός κατάστασης μίας σύνδεσης. Καλείται ΜΕΤΑ την αποθήκευση των
    // connectionInterfaces (στο τέλος των createRouterToDeviceConnectionWithInterface και
    // createRouterToRouterConnectionWithInterfaces), όχι μέσα στο createBasicConnection.
    refreshConnectionStatus(connection) {
        const device1 = window.deviceManager.getDeviceById(connection.device1Id);
        const device2 = window.deviceManager.getDeviceById(connection.device2Id);
        if (!device1 || !device2) return;
        const communication = this.canDevicesCommunicateDirectly(device1, device2);
        connection.canCommunicate = communication.canCommunicate;
        connection.type = communication.viaGateway ? 'routed' : 'direct';
    }

    // Συσκευές με διπλότυπη IP στο ίδιο broadcast domain
    findIPConflicts() {
        return findIPConflicts(this.topology());
    }



    routeExists(routingTable, route) {
        return routingTable.some(existingRoute => 
            existingRoute.network === route.network &&
            existingRoute.mask === route.mask &&
            existingRoute.gateway === route.gateway
        );
    }


    

}

// Εξαγωγή της κλάσης
export default ConnectionManager;
