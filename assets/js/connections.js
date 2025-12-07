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

import { areInSameNetwork, isValidIP } from './network-core.js';

// Διαχείριση συνδέσεων - ΠΛΗΡΩΣ ΔΙΟΡΘΩΜΕΝΗ
class ConnectionManager {
    constructor() {
        this.connections = [];
        this.packets = [];
        this.isSimulating = false;
        this.packetInterval = null;
    }
    
    // Δημιουργία νέας σύνδεσης - ΔΙΟΡΘΩΜΕΝΗ
    createConnection(device1, device2) {
        // Έλεγχος για ύπαρξη σύνδεσης
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        if (existingConnection) {
            console.log(`[CONNECTION INFO] Οι συσκευές ${device1.name} και ${device2.name} είναι ήδη συνδεδεμένες`);
            return existingConnection;
        }
        
        const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const connection = {
            id: connectionId,
            device1Id: device1.id,
            device2Id: device2.id,
            canCommunicate: false,
            type: 'direct'
        };
        
        this.connections.push(connection);
        
        // ΔΙΟΡΘΩΣΗ: Βεβαιώνουμε ότι υπάρχουν τα connections arrays
        if (!device1.connections) {
            console.log(`[CONNECTION FIX] Creating connections array for ${device1.name}`);
            device1.connections = [];
        }
        if (!device2.connections) {
            console.log(`[CONNECTION FIX] Creating connections array for ${device2.name}`);
            device2.connections = [];
        }
        
        // Προσθήκη σύνδεσης στις συσκευές
        device1.connections.push(connectionId);
        device2.connections.push(connectionId);
        
        console.log(`[CONNECTION CREATED] ${device1.name} ↔ ${device2.name}`);
        
        return connection;
    }
    
    // Αφαίρεση σύνδεσης
    removeConnection(connection) {
        const device1 = window.deviceManager.getDeviceById(connection.device1Id);
        const device2 = window.deviceManager.getDeviceById(connection.device2Id);
        
        if (device1 && device1.connections) {
            const index1 = device1.connections.indexOf(connection.id);
            if (index1 !== -1) device1.connections.splice(index1, 1);
        }
        
        if (device2 && device2.connections) {
            const index2 = device2.connections.indexOf(connection.id);
            if (index2 !== -1) device2.connections.splice(index2, 1);
        }
        
        // Αφαίρεση από το DOM
        const connEl = document.getElementById(connection.id);
        if (connEl) connEl.remove();
        
        // Αφαίρεση από τη λίστα συνδέσεων
        const connIndex = this.connections.indexOf(connection);
        if (connIndex !== -1) this.connections.splice(connIndex, 1);
        
        console.log(`[CONNECTION REMOVED] ${connection.id}`);
        return connection;
    }
    
    // Αφαίρεση σύνδεσης με βάση το ID
    removeConnectionById(connectionId) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            return this.removeConnection(connection);
        }
        return null;
    }
    
    // Ενημέρωση όλων των συνδέσεων
    updateAllConnections(devices) {
        console.log(`[UPDATE CONNECTIONS] Total connections: ${this.connections.length}`);
        
        // ΔΙΟΡΘΩΣΗ: Επαναφορά connections arrays αν λείπουν
        devices.forEach(device => {
            if (!device.connections) {
                console.log(`[UPDATE FIX] Creating connections array for ${device.name}`);
                device.connections = [];
            }
        });
        
        this.connections.forEach(conn => {
            const device1 = devices.find(d => d.id === conn.device1Id);
            const device2 = devices.find(d => d.id === conn.device2Id);
            
            if (device1 && device2) {
                const communication = this.canDevicesCommunicateDirectly(device1, device2);
                conn.canCommunicate = communication.canCommunicate;
                conn.type = communication.viaGateway ? 'routed' : 'direct';
            }
        });
        
        this.updateConnectionsVisual();
    }
    
    // Ενημέρωση οπτικής αναπαράστασης συνδέσεων
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
            
            let colorClass;
            if (!conn.canCommunicate) {
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
    
    // Έλεγχος επικοινωνίας μεταξύ συσκευών - ΔΙΟΡΘΩΜΕΝΗ ΜΕ DEBUG
    canDevicesCommunicateDirectly(device1, device2) {
        console.log(`[DIRECT COMM DEBUG] ${device1.name} ↔ ${device2.name}`);
        
        if (device1.id === device2.id) {
            return { canCommunicate: true, viaGateway: false };
        }
        
        // ΕΛΕΓΧΟΣ: Αν είναι συνδεδεμένοι μέσω switch
        if (this.areDevicesConnectedViaSwitch(device1, device2)) {
            console.log(`[DIRECT COMM DEBUG] Connected via switch`);
            
            // Αν και οι δύο είναι switches, απλή σύνδεση
            if (device1.type === 'switch' && device2.type === 'switch') {
                return { canCommunicate: true, viaGateway: false };
            }
            
            // Αν ένας είναι switch (χωρίς IP) και ο άλλος έχει IP
            if ((device1.type === 'switch' && device1.ip === 'N/A') || 
                (device2.type === 'switch' && device2.ip === 'N/A')) {
                return { canCommunicate: true, viaGateway: false };
            }
            
            // Για συσκευές με IP που είναι συνδεδεμένες μέσω switch
            // Πρέπει να ελέγξουμε αν μπορούν να επικοινωνήσουν (ίδιο δίκτυο ή gateway)
            return this.checkCommunicationThroughSwitch(device1, device2);
        }
        
        if (!this.areDevicesConnected(device1, device2)) {
            console.log(`[DIRECT COMM DEBUG] ${device1.name} and ${device2.name} are not physically connected`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Router logic
        if (device1.type === 'router') {
            return this.canCommunicateWithRouter(device1, device2);
        }
        if (device2.type === 'router') {
            return this.canCommunicateWithRouter(device2, device1);
        }
        
        // Standard devices with IP
        return this.canStandardDevicesCommunicate(device1, device2);
    }
    
    // ΝΕΑ ΜΕΘΟΔΟΣ: Έλεγχος επικοινωνίας μέσω switch
    checkCommunicationThroughSwitch(device1, device2) {
        console.log(`[SWITCH COMM] ${device1.name} ↔ ${device2.name} via switch`);
        
        // Αν δεν έχουν IP, δεν μπορούν να επικοινωνήσουν
        if ((!device1.ip || device1.ip === 'N/A' || device1.ip === '0.0.0.0' || device1.ip === undefined) ||
            (!device2.ip || device2.ip === 'N/A' || device2.ip === '0.0.0.0' || device2.ip === undefined)) {
            console.log(`[SWITCH COMM] One or both devices missing IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος αν είναι στο ίδιο δίκτυο
        console.log(`[SWITCH COMM] Checking same network: ${device1.ip}/${device1.subnetMask} vs ${device2.ip}/${device2.subnetMask}`);
        if (areInSameNetwork(device1.ip, device2.ip, device1.subnetMask, device2.subnetMask)) {
            console.log(`[SWITCH COMM] Same network! Communication possible via switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // Αν είναι σε διαφορετικά δίκτυα, πρέπει να έχουν gateway
        console.log(`[SWITCH COMM] Different networks. Checking for gateway...`);
        
        // Αν ΟΥΤΕ ΜΙΑ από τις συσκευές έχει gateway, ΔΕΝ μπορούν να επικοινωνήσουν
        if ((!device1.gateway || device1.gateway === '0.0.0.0' || device1.gateway === 'N/A') &&
            (!device2.gateway || device2.gateway === '0.0.0.0' || device2.gateway === 'N/A')) {
            console.log(`[SWITCH COMM] NO GATEWAY configured. Communication impossible between different networks`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος για gateway
        return this.checkGatewayCommunication(device1, device2);
    }
    
    // ΝΕΑ ΜΕΘΟΔΟΣ: Έλεγχος αν δύο συσκευές είναι συνδεδεμένες μέσω switch
    areDevicesConnectedViaSwitch(device1, device2) {
        // Βρες όλες τις συσκευές που συνδέουν τις δύο συσκευές
        const path = this.findPathBetweenDevices(device1, device2);
        
        if (!path || path.length < 3) {
            return false;
        }
        
        // Έλεγχος αν υπάρχει switch στη διαδρομή (εκτός από τις άκρες)
        for (let i = 1; i < path.length - 1; i++) {
            if (path[i].type === 'switch') {
                console.log(`[VIA SWITCH] ${device1.name} ↔ ${device2.name} via ${path[i].name}`);
                return true;
            }
        }
        
        return false;
    }
    
    // Έλεγχος επικοινωνίας τυπικών συσκευών - ΔΙΟΡΘΩΜΕΝΗ
    canStandardDevicesCommunicate(device1, device2) {
        console.log(`[STANDARD COMM] ${device1.name} (${device1.ip}) ↔ ${device2.name} (${device2.ip})`);
        
        // Αν δεν έχουν IP, δεν μπορούν να επικοινωνήσουν
        if ((!device1.ip || device1.ip === 'N/A' || device1.ip === '0.0.0.0' || device1.ip === undefined) ||
            (!device2.ip || device2.ip === 'N/A' || device2.ip === '0.0.0.0' || device2.ip === undefined)) {
            console.log(`[STANDARD COMM] One or both devices missing IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος αν είναι στο ίδιο δίκτυο
        console.log(`[STANDARD COMM] Checking same network: ${device1.ip}/${device1.subnetMask} vs ${device2.ip}/${device2.subnetMask}`);
        if (areInSameNetwork(device1.ip, device2.ip, device1.subnetMask, device2.subnetMask)) {
            console.log(`[STANDARD COMM] Same network! Direct communication possible`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // ΔΙΟΡΘΩΣΗ: Αν είναι σε διαφορετικά δίκτυα, πρέπει να έχουν gateway
        console.log(`[STANDARD COMM] Different networks. Checking for gateway...`);
        
        // Αν ΟΥΤΕ ΜΙΑ από τις συσκευές έχει gateway, ΔΕΝ μπορούν να επικοινωνήσουν
        if ((!device1.gateway || device1.gateway === '0.0.0.0' || device1.gateway === 'N/A') &&
            (!device2.gateway || device2.gateway === '0.0.0.0' || device2.gateway === 'N/A')) {
            console.log(`[STANDARD COMM] NO GATEWAY configured. Communication impossible between different networks`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος για gateway
        console.log(`[STANDARD COMM] Checking gateway communication...`);
        return this.checkGatewayCommunication(device1, device2);
    }
    
    // Έλεγχος επικοινωνίας μέσω gateway
    checkGatewayCommunication(device1, device2) {
        console.log(`[GATEWAY CHECK] ${device1.name} → ${device2.name}`);
        
        // Έλεγχος αν η device1 έχει gateway και μπορεί να φτάσει στη device2
        if (device1.gateway && device1.gateway !== '0.0.0.0' && device1.gateway !== 'N/A') {
            console.log(`[GATEWAY CHECK] ${device1.name} has gateway: ${device1.gateway}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(device1.gateway);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY CHECK] Gateway device found: ${gatewayDevice.name}`);
                
                // Έλεγχος αν υπάρχει διαδρομή προς το gateway (άμεσα ή μέσω switch)
                if (this.areDevicesConnected(device1, gatewayDevice) || this.areDevicesConnectedViaSwitch(device1, gatewayDevice)) {
                    console.log(`[GATEWAY CHECK] ${device1.name} connected to gateway`);
                    const gatewayComm = this.canDevicesCommunicateDirectly(gatewayDevice, device2);
                    if (gatewayComm.canCommunicate) {
                        console.log(`[GATEWAY CHECK] Gateway can reach target`);
                        return { canCommunicate: true, viaGateway: true };
                    }
                }
            }
        }
        
        // Έλεγχος αν η device2 έχει gateway και μπορεί να φτάσει στη device1
        if (device2.gateway && device2.gateway !== '0.0.0.0' && device2.gateway !== 'N/A') {
            console.log(`[GATEWAY CHECK] ${device2.name} has gateway: ${device2.gateway}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(device2.gateway);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY CHECK] Gateway device found: ${gatewayDevice.name}`);
                
                // Έλεγχος αν υπάρχει διαδρομή προς το gateway (άμεσα ή μέσω switch)
                if (this.areDevicesConnected(device2, gatewayDevice) || this.areDevicesConnectedViaSwitch(device2, gatewayDevice)) {
                    console.log(`[GATEWAY CHECK] ${device2.name} connected to gateway`);
                    const gatewayComm = this.canDevicesCommunicateDirectly(device1, gatewayDevice);
                    if (gatewayComm.canCommunicate) {
                        console.log(`[GATEWAY CHECK] Gateway can reach source`);
                        return { canCommunicate: true, viaGateway: true };
                    }
                }
            }
        }
        
        console.log(`[GATEWAY CHECK] No gateway communication possible`);
        return { canCommunicate: false, viaGateway: false };
    }
    
    // Έλεγχος επικοινωνίας με router - ΔΙΟΡΘΩΜΕΝΗ ΜΕ DEBUG
    canCommunicateWithRouter(router, otherDevice) {
        console.log(`[ROUTER COMM] ${router.name} ↔ ${otherDevice.name}`);
        console.log(`[ROUTER COMM] Router WAN: ${router.interfaces.wan.ip}, LAN: ${router.interfaces.lan.ip}`);
        console.log(`[ROUTER COMM] Other: ${otherDevice.name} (${otherDevice.type}), IP: ${otherDevice.ip}`);
        
        // Router ↔ Switch (χωρίς IP) - φυσική σύνδεση
        if (otherDevice.type === 'switch' && otherDevice.ip === 'N/A') {
            console.log(`[ROUTER COMM] Direct connection to switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // Έλεγχος αν το router έχει valid LAN IP
        const routerLanIP = router.interfaces.lan.ip;
        if (!routerLanIP || routerLanIP === 'N/A' || routerLanIP === '0.0.0.0' || routerLanIP === undefined) {
            console.log(`[ROUTER COMM] Router has no valid LAN IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος αν η συσκευή είναι στο LAN του router
        if (otherDevice.ip && otherDevice.ip !== 'N/A' && otherDevice.ip !== '0.0.0.0' && otherDevice.ip !== undefined) {
            console.log(`[ROUTER COMM] Checking if ${otherDevice.ip} is in same network as router LAN ${routerLanIP}`);
            
            if (areInSameNetwork(otherDevice.ip, routerLanIP, 
                                otherDevice.subnetMask, router.interfaces.lan.subnetMask)) {
                console.log(`[ROUTER COMM] Device is in router's LAN`);
                return { canCommunicate: true, viaGateway: false };
            }
        }
        
        // Έλεγχος αν η συσκευή έχει ως gateway το router LAN
        if (otherDevice.gateway && otherDevice.gateway !== '0.0.0.0' && otherDevice.gateway !== 'N/A') {
            console.log(`[ROUTER COMM] Device gateway: ${otherDevice.gateway}, Router LAN: ${routerLanIP}`);
            if (otherDevice.gateway === routerLanIP) {
                console.log(`[ROUTER COMM] Device uses router as gateway`);
                
                // Έλεγχος αν το router γνωρίζει τον προορισμό (routes)
                if (router.routingTable && router.routingTable.length > 0) {
                    // Απλοποιημένος έλεγχος routing table
                    const targetNetwork = this.getNetworkAddress(otherDevice.ip, otherDevice.subnetMask);
                    const hasRoute = router.routingTable.some(route => 
                        this.isIPInNetwork(otherDevice.ip, route.network, route.mask)
                    );
                    
                    if (hasRoute) {
                        console.log(`[ROUTER COMM] Router has route to ${otherDevice.ip}`);
                        return { canCommunicate: true, viaGateway: true };
                    } else {
                        console.log(`[ROUTER COMM] Router has NO route to ${otherDevice.ip}`);
                        return { canCommunicate: false, viaGateway: false };
                    }
                }
                
                return { canCommunicate: true, viaGateway: true };
            }
        }
        
        // Έλεγχος για WAN communication (Cloud ↔ Router)
        if (otherDevice.type === 'cloud' || otherDevice.type === 'router') {
            const routerWanIP = router.interfaces.wan.ip;
            if (routerWanIP && routerWanIP !== 'N/A' && routerWanIP !== '0.0.0.0' && routerWanIP !== undefined) {
                if (otherDevice.ip && areInSameNetwork(otherDevice.ip, routerWanIP, 
                                                     otherDevice.subnetMask, router.interfaces.wan.subnetMask)) {
                    console.log(`[ROUTER COMM] WAN communication with ${otherDevice.name}`);
                    return { canCommunicate: true, viaGateway: false };
                }
            }
        }
        
        console.log(`[ROUTER COMM] No communication possible`);
        return { canCommunicate: false, viaGateway: false };
    }
    
    // Βοηθητικές συναρτήσεις
    areDevicesConnected(device1, device2) {
        // ΔΙΟΡΘΩΣΗ: Έλεγχος αν υπάρχουν τα arrays πρώτα
        if (!device1.connections || !device2.connections) {
            console.log(`[CONNECTION WARN] Missing connections array for ${device1.name} or ${device2.name}`);
            return false;
        }
        
        const isConnected = this.connections.some(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        console.log(`[ARE CONNECTED] ${device1.name} ↔ ${device2.name}: ${isConnected}`);
        return isConnected;
    }
    
    shouldUseGateway(sourceDevice, destIP, destSubnetMask = '255.255.255.0') {
        if (!sourceDevice.gateway || sourceDevice.gateway === '0.0.0.0') {
            return false;
        }
        
        // Αν η πηγή και ο προορισμός είναι στο ίδιο δίκτυο, ΔΕΝ χρειάζεται gateway
        if (areInSameNetwork(sourceDevice.ip, destIP, sourceDevice.subnetMask, destSubnetMask)) {
            return false;
        }
        
        return true;
    }
    
    // Βρίσκει όλες τις συνδεδεμένες συσκευές μιας συσκευής - ΔΙΟΡΘΩΜΕΝΗ
    getConnectedDevices(device) {
        const connected = [];
        
        // ΔΙΟΡΘΩΣΗ: Αν λείπει το array, επέστρεψε κενό
        if (!device.connections) {
            console.log(`[GET CONNECTIONS WARN] No connections array for ${device.name}`);
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
        
        console.log(`[GET CONNECTED DEVICES] ${device.name}: ${connected.map(d => d.name).join(', ')}`);
        return connected;
    }
    
    // Βρίσκει διαδρομή μεταξύ δύο συσκευών - ΠΛΗΡΩΣ ΔΙΟΡΘΩΜΕΝΗ (BFS)
    findPathBetweenDevices(device1, device2) {
        if (device1.id === device2.id) return [device1];
        
        console.log(`[PATH DEBUG] Finding path: ${device1.name} → ${device2.name}`);
        
        // 1. Άμεση σύνδεση
        if (this.areDevicesConnected(device1, device2)) {
            console.log(`[PATH DEBUG] Direct connection found`);
            return [device1, device2];
        }
        
        // 2. BFS για εύρεση διαδρομής
        const visited = new Set();
        const queue = [{ device: device1, path: [device1] }];
        visited.add(device1.id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            const connectedDevices = this.getConnectedDevices(current.device);
            
            console.log(`[PATH DEBUG] Current: ${current.device.name}, Connected: ${connectedDevices.map(d => d.name).join(', ')}`);
            
            for (const neighbor of connectedDevices) {
                if (visited.has(neighbor.id)) continue;
                
                visited.add(neighbor.id);
                const newPath = [...current.path, neighbor];
                
                // Αν φτάσαμε στον προορισμό
                if (neighbor.id === device2.id) {
                    console.log(`[PATH DEBUG] Path found: ${newPath.map(d => d.name).join(' → ')}`);
                    return newPath;
                }
                
                queue.push({ device: neighbor, path: newPath });
            }
        }
        
        console.log(`[PATH DEBUG] NO PATH FOUND from ${device1.name} to ${device2.name}`);
        return null;
    }
    
    // Έλεγχος επικοινωνίας με πλήρη διαδρομή - ΔΙΟΡΘΩΜΕΝΗ (ΚΡΙΤΙΚΗ ΔΙΟΡΘΩΣΗ)
    canDevicesCommunicateWithPath(device1, device2) {
        const path = this.findPathBetweenDevices(device1, device2);
        
        console.log(`[COMM PATH] ${device1.name} → ${device2.name}:`, 
                   path ? path.map(d => d.name).join(' → ') : 'NO PATH');
        
        if (!path || path.length < 2) {
            console.log(`[COMM PATH] No path or invalid path length`);
            return { canCommunicate: false, viaGateway: false, path: null };
        }
        
        // ΚΡΙΤΙΚΗ ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε τη νέα μέθοδο canDevicesCommunicateDirectly
        // που τώρα υποστηρίζει επικοινωνία μέσω switch
        const directComm = this.canDevicesCommunicateDirectly(device1, device2);
        
        if (directComm.canCommunicate) {
            console.log(`[COMM PATH] Communication possible: ${directComm.viaGateway ? 'via Gateway' : 'direct'}`);
            return { 
                canCommunicate: true, 
                viaGateway: directComm.viaGateway, 
                path: path 
            };
        }
        
        console.log(`[COMM PATH] Communication NOT possible between ${device1.name} and ${device2.name}`);
        return { canCommunicate: false, viaGateway: false, path: null };
    }
    
    // Νέες μέθοδοι για UI
    removeDevice(device) {
        // Αφαίρεση όλων των συνδέσεων της συσκευής
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            this.removeConnectionById(connId);
        });
        
        return device;
    }
    
    // Καθαρισμός όλων των συνδέσεων
    clearAllConnections() {
        // Δημιουργία αντίγραφου για να αποφύγουμε προβλήματα κατά τη διαγραφή
        const connectionsCopy = [...this.connections];
        connectionsCopy.forEach(connection => {
            this.removeConnection(connection);
        });
        
        this.connections = [];
        this.packets = [];
    }
    
    // Βοηθητική συνάρτηση: getNetworkAddress (παρόμοια με network-core.js)
    getNetworkAddress(ip, subnetMask) {
        if (!ip || ip === 'N/A') return null;
        const ipParts = ip.split('.').map(Number);
        const maskParts = subnetMask.split('.').map(Number);
        
        const networkParts = ipParts.map((part, i) => part & maskParts[i]);
        return networkParts.join('.');
    }
    
    // Βοηθητική συνάρτηση: isIPInNetwork
    isIPInNetwork(ip, network, subnetMask) {
        const ipNetwork = this.getNetworkAddress(ip, subnetMask);
        return ipNetwork === network;
    }
}

// Εξαγωγή της κλάσης
export default ConnectionManager;
