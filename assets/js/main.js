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
// Κύριο αρχείο εφαρμογής - ΕΝΑ entry point για modules
import DeviceManager from './devices.js';
import ConnectionManager from './connections.js';
import DNSManager from './dns.js';
import SimulationManager from './simulation.js';
import UIManager from './ui.js';
import * as NetworkCore from './network-core.js';

// ========== ΔΙΟΡΘΩΣΗ: ΒΕΒΑΙΩΣΗ ΟΤΙ ΥΠΑΡΧΕΙ CONFIG ==========
if (!window.CONFIG) {
    console.error('CONFIG is not defined! Creating default configuration...');
    
    window.CONFIG = {
        DEVICE_TYPES: {
            'router': { icon: 'fas fa-wifi', color: '#3498db', name: 'Router' },
            'switch': { icon: 'fas fa-network-wired', color: '#2ecc71', name: 'Switch' },
            'computer': { icon: 'fas fa-desktop', color: '#e74c3c', name: 'Υπολογιστής' },
            'server': { icon: 'fas fa-server', color: '#9b59b6', name: 'Server' },
            'cloud': { icon: 'fas fa-cloud', color: '#f39c12', name: 'Cloud (WAN)' },
            'printer': { icon: 'fas fa-print', color: '#34495e', name: 'Εκτυπωτής' },
            'dns': { icon: 'fas fa-search', color: '#9b59b6', name: 'DNS Server' },
            'firewall': { icon: 'fas fa-shield-alt', color: '#e74c3c', name: 'Firewall' }
        },
        
        DEFAULT_LAN_RANGE: '192.168.1.0/24',
        DEFAULT_WAN_RANGE: '203.0.113.0/24',
        DEFAULT_DNS_SERVERS: ['8.8.8.8', '8.8.4.4'],
        
        SIMULATION_INTERVAL: 800,
        PACKET_DURATION_MIN: 1500,
        PACKET_DURATION_MAX: 2500,
        
        PATH_ANIMATION_DURATION: 3000,
        DNS_QUERY_ANIMATION_DURATION: 800,
        
        LOG_MAX_ENTRIES: 50,
        AUTO_SAVE_INTERVAL: 30000
    };
    
    console.log('Default CONFIG created:', window.CONFIG);
}

console.log('Main.js loaded with CONFIG:', window.CONFIG.DEVICE_TYPES ? 'DEVICE_TYPES OK' : 'MISSING DEVICE_TYPES');
// Κύριο αρχείο εφαρμογής
class NetworkSimulator {
    constructor() {
        // Αρχικοποίηση managers
        this.deviceManager = new DeviceManager();
        this.connectionManager = new ConnectionManager();
        this.dnsManager = new DNSManager();
        this.simulationManager = new SimulationManager(this.connectionManager);
        this.uiManager = new UIManager(
            this.deviceManager, 
            this.connectionManager, 
            this.dnsManager, 
            this.simulationManager
        );
        
        // Κάντε τους managers προσβάσιμους global για συμβατότητα
        window.deviceManager = this.deviceManager;
        window.connectionManager = this.connectionManager;
        window.dnsManager = this.dnsManager;
        window.simulationManager = this.simulationManager;
        window.uiManager = this.uiManager;
        
        // Κάντε τις συναρτήσεις NetworkCore προσβάσιμες
        Object.assign(window, NetworkCore);
    }

		clearAllDNSRecords() {
		    const result = this.dnsManager.clearAllDNSRecords();
		    if (result) {
		        this.uiManager.addLog('Καθαρίστηκαν όλα τα DNS records', 'success');
        
       		 // Reload default DNS records
		        this.dnsManager.loadDNSRecords();
		        this.uiManager.addLog('Φορτώθηκαν τα προεπιλεγμένα DNS records', 'info');
        
		        // Refresh UI if a DNS device is selected
		        if (this.deviceManager.selectedDevice && this.deviceManager.selectedDevice.type === 'dns') {
		            this.uiManager.updateDeviceInfo(this.deviceManager.selectedDevice);
		        }
		    }
		    return result;
		}    
    // Αρχικοποίηση εφαρμογής
    async initialize() {
        // Εκτέλεση των κύριων συναρτήσεων
        this.uiManager.initializeEventListeners();
        this.uiManager.exposeFunctions();
        
        // Δημιουργία επίδειξης
        this.createDemoNetwork();
    }
    
    // Δημιουργία επίδειξης δικτύου
    async createDemoNetwork() {
        setTimeout(async () => {
            this.uiManager.addLog('Δημιουργία επίδειξης LAN με DNS...', 'info');
            
            const demoRouter = this.uiManager.addDeviceToWorkspace('router', '#3498db');
            const demoSwitch = this.uiManager.addDeviceToWorkspace('switch', '#2ecc71');
            const demoComputer = this.uiManager.addDeviceToWorkspace('computer', '#e74c3c');
            const demoServer = this.uiManager.addDeviceToWorkspace('server', '#9b59b6');
            const demoDns = this.uiManager.addDeviceToWorkspace('dns', '#9b59b6');
            
            setTimeout(() => {
                // Τοποθέτηση συσκευών
                this.positionDevice(demoRouter, 300, 150);
                this.positionDevice(demoSwitch, 300, 300);
                this.positionDevice(demoComputer, 100, 300);
                this.positionDevice(demoServer, 500, 300);
                this.positionDevice(demoDns, 300, 450);
                
                // Ρυθμίσεις συσκευών
                this.configureRouter(demoRouter);
                this.configureDNS(demoDns, demoRouter);
                this.configureComputer(demoComputer, demoRouter);
                this.configureServer(demoServer, demoRouter);
                
                // Ορισμός domain name
                setTimeout(() => {
                    this.assignDomain(demoServer, 'myserver.local');
                    
                    // Δημιουργία συνδέσεων
                    this.createDemoConnections(demoRouter, demoSwitch, demoDns, demoComputer, demoServer);
                    
                    // EXTREME DEBUGGING
                    this.debugNetworkState();
                    
                    this.uiManager.deviceManager.selectDevice(demoComputer);
                    
                    this.uiManager.addLog('Επίδειξη δημιουργήθηκε!', 'success');
                    this.uiManager.addLog('Ο server έχει domain name: myserver.local', 'info');
                    this.uiManager.addLog('Δοκιμή διαδρομής: Επιλέξτε "Δοκιμή Διαδρομής" στον υπολογιστή', 'info');
                }, 100);
            }, 50);
        }, 100);
    }
    
    // Βοηθητικές συναρτήσεις για τη δημιουργία επίδειξης
    positionDevice(device, x, y) {
        device.x = x;
        device.y = y;
        device.element.style.left = `${x}px`;
        device.element.style.top = `${y}px`;
    }
    
    configureRouter(router) {
        router.interfaces.lan.ip = '192.168.1.1';
        router.interfaces.lan.subnetMask = '255.255.255.0';
        router.interfaces.lan.dns = ['192.168.1.53'];
        router.element.querySelector('.device-ip').innerHTML = `WAN: N/A<br>LAN: 192.168.1.1`;
    }
    
    configureDNS(dnsDevice, router) {
        dnsDevice.ip = '192.168.1.53';
        dnsDevice.gateway = '192.168.1.1';
        dnsDevice.dns = ['192.168.1.53'];
        dnsDevice.element.querySelector('.device-ip').textContent = '192.168.1.53';
    }
    
    configureComputer(computer, router) {
        computer.ip = '192.168.1.10';
        computer.gateway = '192.168.1.1';
        computer.dns = ['192.168.1.53'];
        computer.element.querySelector('.device-ip').textContent = '192.168.1.10';
    }
    
    configureServer(server, router) {
        server.ip = '192.168.1.100';
        server.gateway = '192.168.1.1';
        server.dns = ['192.168.1.53'];
        server.element.querySelector('.device-ip').textContent = '192.168.1.100';
    }
    
    assignDomain(device, domain) {
        device.domainName = domain;
        this.dnsManager.globalDnsRecords[domain] = device.ip;
    }
    
// Στο simulator.createDemoConnections() (περίπου γραμμή 180):
createDemoConnections(router, switchDev, dnsServer, computer, server) {
    try {
        this.connectionManager.createConnection(router, switchDev);
        this.connectionManager.createConnection(switchDev, dnsServer);
        this.connectionManager.createConnection(switchDev, computer);
        this.connectionManager.createConnection(switchDev, server);
        
        // Ειδική περίπτωση αν υπάρχουν 2 routers
        const routers = this.deviceManager.devices.filter(d => d.type === 'router');
        if (routers.length >= 2) {
            // Σύνδεση routers (θα ζητηθεί interface από τον χρήστη)
            this.connectionManager.createConnection(routers[0], routers[1]);
        }
        
        this.connectionManager.updateAllConnections(this.deviceManager.devices);
    } catch (error) {
        this.uiManager.addLog(`Σφάλμα στη δημιουργία συνδέσεων: ${error.message}`, 'error');
    }
}    
    // Συναρτήσεις για προκαθορισμένα δίκτυα
    createPredefinedLan() {
        this.clearWorkspace();
        this.uiManager.addLog('Δημιουργία προκαθορισμένου LAN δικτύου...', 'info');
        
        const router = this.uiManager.addDeviceToWorkspace('router', '#3498db');
        const switchDev = this.uiManager.addDeviceToWorkspace('switch', '#2ecc71');
        const computer1 = this.uiManager.addDeviceToWorkspace('computer', '#e74c3c');
        const server = this.uiManager.addDeviceToWorkspace('server', '#9b59b6');
        const dnsServer = this.uiManager.addDeviceToWorkspace('dns', '#9b59b6');
        
        setTimeout(() => {
            this.positionDevice(router, 100, 100);
            this.positionDevice(switchDev, 300, 100);
            this.positionDevice(computer1, 500, 50);
            this.positionDevice(server, 500, 150);
            this.positionDevice(dnsServer, 300, 300);
            
            // Ρυθμίσεις Router
            router.interfaces.lan.ip = '192.168.1.1';
            router.interfaces.lan.subnetMask = '255.255.255.0';
            router.interfaces.lan.dns = ['192.168.1.53'];
            router.element.querySelector('.device-ip').innerHTML = `WAN: N/A<br>LAN: 192.168.1.1`;
            
            // Ρυθμίσεις DNS Server
            dnsServer.ip = '192.168.1.53';
            dnsServer.gateway = '192.168.1.1';
            dnsServer.dns = ['192.168.1.53'];
            dnsServer.element.querySelector('.device-ip').textContent = '192.168.1.53';
            
            // Ρυθμίσεις Computer
            computer1.ip = '192.168.1.10';
            computer1.gateway = '192.168.1.1';
            computer1.dns = ['192.168.1.53'];
            computer1.element.querySelector('.device-ip').textContent = '192.168.1.10';
            
            // Ρυθμίσεις Server
            server.ip = '192.168.1.100';
            server.gateway = '192.168.1.1';
            server.dns = ['192.168.1.53'];
            server.element.querySelector('.device-ip').textContent = '192.168.1.100';
            
            setTimeout(() => {
                this.assignDomain(server, 'fileserver.local');
                
                try {
                    this.connectionManager.createConnection(router, switchDev);
                    this.connectionManager.createConnection(switchDev, dnsServer);
                    this.connectionManager.createConnection(switchDev, server);
                    this.connectionManager.createConnection(switchDev, computer1);
                    this.connectionManager.updateAllConnections(this.deviceManager.devices);
                    
                    // EXTREME DEBUGGING
                    this.debugNetworkState();
                    
                    this.uiManager.deviceManager.selectDevice(router);
                    
                    this.uiManager.addLog('Προκαθορισμένο LAN δημιουργήθηκε!', 'success');
                    this.uiManager.addLog('Δοκιμή διαδρομής: Επιλέξτε "Δοκιμή Διαδρομής" στον υπολογιστή', 'info');
                } catch (error) {
                    this.uiManager.addLog(`Σφάλμα: ${error.message}`, 'error');
                }
            }, 100);
        }, 100);
    }
    
    createPredefinedWan() {
        this.clearWorkspace();
        this.uiManager.addLog('Δημιουργία προκαθορισμένου WAN δικτύου...', 'info');
        
        const cloud = this.uiManager.addDeviceToWorkspace('cloud', '#f39c12');
        const router = this.uiManager.addDeviceToWorkspace('router', '#3498db');
        const switchDev = this.uiManager.addDeviceToWorkspace('switch', '#2ecc71');
        const computer1 = this.uiManager.addDeviceToWorkspace('computer', '#e74c3c');
        const server = this.uiManager.addDeviceToWorkspace('server', '#9b59b6');
        const dnsServer = this.uiManager.addDeviceToWorkspace('dns', '#9b59b6');
        
        setTimeout(() => {
            this.positionDevice(cloud, 600, 150);
            this.positionDevice(router, 300, 150);
            this.positionDevice(switchDev, 300, 350);
            this.positionDevice(computer1, 100, 350);
            this.positionDevice(server, 500, 350);
            this.positionDevice(dnsServer, 300, 550);
            
            // Ρυθμίσεις Cloud
            cloud.ip = '203.0.113.1';
            cloud.subnetMask = '255.255.255.0';
            cloud.dns = ['8.8.8.8'];
            cloud.element.querySelector('.device-ip').textContent = '203.0.113.1';
            
            // Ρυθμίσεις Router
            router.interfaces.wan.ip = '203.0.113.10';
            router.interfaces.wan.subnetMask = '255.255.255.0';
            router.interfaces.wan.gateway = '203.0.113.1';
            router.interfaces.wan.dns = ['8.8.8.8'];
            router.interfaces.lan.ip = '192.168.1.1';
            router.interfaces.lan.subnetMask = '255.255.255.0';
            router.interfaces.lan.gateway = '0.0.0.0';
            router.interfaces.lan.dns = ['192.168.1.53'];
            router.element.querySelector('.device-ip').innerHTML = `WAN: 203.0.113.10<br>LAN: 192.168.1.1`;
            
            // Ρυθμίσεις DNS Server
            dnsServer.ip = '192.168.1.53';
            dnsServer.subnetMask = '255.255.255.0';
            dnsServer.gateway = '192.168.1.1';
            dnsServer.dns = ['192.168.1.53'];
            dnsServer.element.querySelector('.device-ip').textContent = '192.168.1.53';
            
            // Ρυθμίσεις Computer
            computer1.ip = '192.168.1.10';
            computer1.subnetMask = '255.255.255.0';
            computer1.gateway = '192.168.1.1';
            computer1.dns = ['192.168.1.53'];
            computer1.element.querySelector('.device-ip').textContent = '192.168.1.10';
            
            // Ρυθμίσεις Server
            server.ip = '192.168.1.100';
            server.subnetMask = '255.255.255.0';
            server.gateway = '192.168.1.1';
            server.dns = ['192.168.1.53'];
            server.element.querySelector('.device-ip').textContent = '192.168.1.100';
            
            setTimeout(() => {
                this.assignDomain(server, 'webserver.local');
                this.assignDomain(cloud, 'cloud.example.com');
                
                // Προσθήκη static routes για το router
                if (!router.routingTable) router.routingTable = [];
                router.routingTable.push({
                    network: '203.0.113.0',
                    mask: '255.255.255.0',
                    gateway: '0.0.0.0',
                    interface: 'wan'
                });
                router.routingTable.push({
                    network: '192.168.1.0',
                    mask: '255.255.255.0',
                    gateway: '0.0.0.0',
                    interface: 'lan'
                });
                
                try {
                    this.connectionManager.createConnection(cloud, router);
                    this.connectionManager.createConnection(router, switchDev);
                    this.connectionManager.createConnection(switchDev, dnsServer);
                    this.connectionManager.createConnection(switchDev, computer1);
                    this.connectionManager.createConnection(switchDev, server);
                    this.connectionManager.updateAllConnections(this.deviceManager.devices);
                    
                    // EXTREME DEBUGGING
                    this.debugNetworkState();
                    
                    this.uiManager.deviceManager.selectDevice(router);
                    
                    this.uiManager.addLog('Προκαθορισμένο WAN δημιουργήθηκε!', 'success');
                    this.uiManager.addLog('Δοκιμή διαδρομής: Επιλέξτε "Δοκιμή Διαδρομής" στον υπολογιστή', 'info');
                } catch (error) {
                    this.uiManager.addLog(`Σφάλμα: ${error.message}`, 'error');
                }
            }, 100);
        }, 100);
    }
    
    clearWorkspace() {
        if (this.simulationManager.isSimulating) {
            this.simulationManager.stopSimulation();
        }
        
        // Καθαρισμός συσκευών
        this.deviceManager.devices.forEach(device => {
            if (device.element && device.element.parentNode) {
                device.element.remove();
            }
        });
        this.deviceManager.devices = [];
        this.deviceManager.deviceCounter = 1;
        this.deviceManager.selectedDevice = null;
        
        // Καθαρισμός συνδέσεων
        this.connectionManager.clearAllConnections();
        
        // Επαναφορά UI
        this.uiManager.connectionMode = false;
        this.uiManager.testMode = false;
        this.uiManager.manualDNSMode = false;
        this.uiManager.firstDeviceForConnection = null;
        this.uiManager.firstTestDevice = null;
        this.uiManager.dnsSourceDevice = null;
        
        // Επαναφορά buttons
        this.uiManager.buttons.connect.classList.remove('active');
        this.uiManager.buttons.simulate.classList.remove('active');
        this.uiManager.buttons.testRoute.classList.remove('active');
        this.uiManager.buttons.manualDNS.classList.remove('active');
        
        this.uiManager.connectionModeText.innerHTML = `<i class="fas fa-mouse-pointer"></i> Κατάσταση: Επιλογή Συσκευών`;
        this.uiManager.updateDeviceInfo(null);
        
        // Επαναφορά DNS
        this.dnsManager.loadDNSRecords();
        
        this.uiManager.addLog('Το workspace καθαρίστηκε.', 'info');
    }
    
    // Χειρισμός test functions
    testPingBetweenDevices() {
        const result = this.simulationManager.testPingBetweenDevices(this.deviceManager);
        return result;
    }
    
    testPingFromDevice(fromDevice) {
        // Χρήση της νέας μεθόδου που θα προσθέσουμε στο simulation.js
        return this.simulationManager.testPingFromDeviceWithPrompt(fromDevice, this.deviceManager);
    }
    
    testCommunicationBetween(device1, device2) {
        const result = this.simulationManager.testCommunicationBetween(device1, device2);
        return result;
    }
    
    testRouteFromDevice(fromDevice) {
        this.uiManager.testMode = true;
        this.uiManager.firstTestDevice = fromDevice;
        fromDevice.element.classList.add('test-mode');
        this.uiManager.connectionModeText.innerHTML = `<i class="fas fa-route"></i> Κατάσταση: Επιλέξτε 2η συσκευή για δοκιμή από ${fromDevice.name}`;
        this.uiManager.addLog(`Επιλέχθηκε πρώτη συσκευή για δοκιμή διαδρομής: ${fromDevice.name}`, 'info');
    }
    
    testAutoDNS() {
        const devices = this.deviceManager.devices;
        if (devices.length < 2) {
            alert('Πρέπει να υπάρχουν τουλάχιστον 2 συσκευές για δοκιμή DNS');
            return;
        }
        
        // Βρες μια συσκευή που έχει DNS ρυθμισμένο
        const deviceWithDNS = devices.find(d => 
            d.type !== 'switch' && 
            d.type !== 'router' && 
            d.ip !== 'N/A' && 
            d.dns && 
            d.dns.length > 0 && 
            d.dns[0] !== '0.0.0.0'
        );
        
        if (!deviceWithDNS) {
            alert('Δεν βρέθηκε συσκευή με ρυθμισμένο DNS server. Ρυθμίστε πρώτα DNS σε έναν υπολογιστή ή server.');
            return;
        }
        
        // Αυτόματη εύρεση του ρυθμισμένου DNS server
        const dnsServerDevice = this.dnsManager.getConfiguredDNSServer(deviceWithDNS, this.deviceManager);
        
        if (!dnsServerDevice) {
            alert(`Η συσκευή ${deviceWithDNS.name} δεν έχει έγκυρο DNS server.\n\nΠιθανά προβλήματα:\n1. Το DNS IP δεν αντιστοιχεί σε συσκευή στο δίκτυο\n2. Η συσκευή με το DNS IP δεν είναι DNS server\n\nΡυθμίστε έγκυρο DNS ή χρησιμοποιήστε Χειροκίνητο DNS.`);
            return;
        }
        
        // ΖΗΤΑΜΟΝΟ ΜΙΑ ΦΟΡΑ το domain name
        const domain = prompt(`Εισάγετε domain name για DNS query από ${deviceWithDNS.name}:\n\nΧρησιμοποιεί αυτόματα τον ρυθμισμένο DNS server: ${dnsServerDevice.name} (${deviceWithDNS.dns[0]})\n\nΔιαθέσιμα domains:\n${Object.keys(this.dnsManager.globalDnsRecords).map(d => `• ${d}`).join('\n')}\n\nΜπορείτε επίσης να εισάγετε νέο domain.`);
        
        if (domain) {
            // Εκτέλεση DNS query
            const resolvedIP = this.testDNSQuery(deviceWithDNS, dnsServerDevice, domain);
            
            if (resolvedIP) {
                // Αν η επίλυση ήταν επιτυχής, δοκιμή επικοινωνίας με τη συσκευή
                setTimeout(() => {
                    const targetDevice = this.deviceManager.getDeviceByIP(resolvedIP.ip);
                    if (targetDevice) {
                        this.uiManager.addLog(`DNS RESOLUTION SUCCESS: ${domain} → ${resolvedIP.ip} (${targetDevice.name})`, 'success');
                        this.uiManager.addLog(`Επικοινωνία ${deviceWithDNS.name} → ${targetDevice.name}...`, 'info');
                        this.testCommunicationBetween(deviceWithDNS, targetDevice);
                    }
                }, 2000);
            }
        }
    }
    
    testAutoDNSFromDevice(fromDevice) {
        const devices = this.deviceManager.devices;
        if (devices.length < 2) {
            alert('Πρέπει να υπάρχουν τουλάχιστον 2 συσκευές για δοκιμή DNS');
            return;
        }
        
        // Έλεγχος αν η συσκευή έχει ρυθμισμένο DNS
        if (!fromDevice.dns || fromDevice.dns.length === 0 || !fromDevice.dns[0] || fromDevice.dns[0] === '0.0.0.0') {
            alert(`Η συσκευή ${fromDevice.name} δεν έχει ρυθμισμένο DNS server!\n\nΠαρακαλώ ρυθμίστε ένα DNS server στις πληροφορίες της συσκευής.`);
            this.uiManager.addLog(`DNS ERROR: Ο ${fromDevice.name} δεν έχει ρυθμισμένο DNS server`, 'error');
            return;
        }
        
        // Αυτόματη εύρεση του ρυθμισμένου DNS server
        const dnsServerDevice = this.dnsManager.getConfiguredDNSServer(fromDevice, this.deviceManager);
        
        if (!dnsServerDevice) {
            alert(`Η συσκευή ${fromDevice.name} δεν έχει έγκυρο DNS server.\n\nΠιθανά προβλήματα:\n1. Το DNS IP δεν αντιστοιχεί σε συσκευή στο δικτυο\n2. Η συσκευή με το DNS IP δεν είναι DNS server\n\nΧρησιμοποιήστε Χειροκίνητο DNS για να επιλέξετε DNS server.`);
            this.uiManager.addLog(`DNS ERROR: Ο ${fromDevice.name} δεν έχει έγκυρο DNS server (${fromDevice.dns[0]})`, 'error');
            return;
        }
        
        // ΖΗΤΑΜΟΝΟ ΜΙΑ ΦΟΡΑ το domain name
        const domain = prompt(`Εισάγετε domain name για DNS query από ${fromDevice.name}:\n\nΧρησιμοποιεί αυτόματα τον ρυθμισμένο DNS server: ${dnsServerDevice.name} (${fromDevice.dns[0]})\n\nΔιαθέσιμα domains:\n${Object.keys(this.dnsManager.globalDnsRecords).map(d => `• ${d}`).join('\n')}\n\nΜπορείτε επίσης να εισάγετε νέο domain.`);
        
        if (domain) {
            // Εκτέλεση DNS query
            const resolvedIP = this.testDNSQuery(fromDevice, dnsServerDevice, domain);
            
            if (resolvedIP) {
                // Αν η επίλυση ήταν επιτυχής, δοκιμή επικοινωνίας με τη συσκευή
                setTimeout(() => {
                    const targetDevice = this.deviceManager.getDeviceByIP(resolvedIP.ip);
                    if (targetDevice) {
                        this.uiManager.addLog(`DNS RESOLUTION SUCCESS: ${domain} → ${resolvedIP.ip} (${targetDevice.name})`, 'success');
                        this.uiManager.addLog(`Επικοινωνία ${fromDevice.name} → ${targetDevice.name}...`, 'info');
                        this.testCommunicationBetween(fromDevice, targetDevice);
                    }
                }, 2000);
            }
        }
    }
    
    testManualDNSFromDevice(fromDevice) {
        this.uiManager.manualDNSMode = true;
        this.uiManager.dnsSourceDevice = fromDevice;
        fromDevice.element.classList.add('dns-source-mode');
        this.uiManager.connectionModeText.innerHTML = `<i class="fas fa-hand-pointer"></i> Κατάσταση: Επιλέξτε DNS Server για query από ${fromDevice.name}`;
        this.uiManager.addLog(`Επιλέχθηκε πηγή για χειροκίνητο DNS query: ${fromDevice.name}`, 'info');
        this.uiManager.addLog(`Στη συνέχεια, θα ζητηθεί να εισαγάγετε ένα domain name`, 'info');
    }
    
    testDNSQuery(fromDevice, dnsServerDevice, domain) {
        this.uiManager.addLog(`DNS QUERY: ${fromDevice.name} → ${dnsServerDevice.name} για "${domain}"`, 'info');
        this.uiManager.addLog(`Πηγή DNS: ${fromDevice.dns ? fromDevice.dns[0] : 'N/A'}`, 'info');
        
        // 1. Έλεγχος αν ο DNS server μπορεί να λύσει DNS queries
        if (!this.dnsManager.canResolveDNS(dnsServerDevice)) {
            this.uiManager.addLog(`DNS ERROR: Η συσκευή ${dnsServerDevice.name} δεν είναι DNS server και δεν μπορεί να λύσει DNS queries`, 'error');
            alert(`Σφάλμα: Η συσκευή ${dnsServerDevice.name} δεν είναι DNS server!`);
            return null;
        }
        
        // 2. DNS Query από πηγή προς DNS server
        const dnsQueryPath = this.connectionManager.findPathBetweenDevices(fromDevice, dnsServerDevice);
        if (!dnsQueryPath) {
            this.uiManager.addLog(`DNS QUERY ΑΠΟΤΥΧΙΑ: Δεν υπάρχει διαδρομή προς τον DNS server ${dnsServerDevice.name}`, 'error');
            return null;
        }
        
        // Προσομοίωση DNS query
        this.dnsManager.visualizeDNSQuery(dnsQueryPath, fromDevice, dnsServerDevice, domain, 'query');
        
        // 3. DNS Resolution
        const resolution = this.dnsManager.testDNSQuery(fromDevice, dnsServerDevice, domain, this.deviceManager);
        
        if (resolution) {
            this.uiManager.addLog(`DNS RESPONSE: ${domain} → ${resolution.ip} (${resolution.source}, via ${dnsServerDevice.name})`, 'success');
            
            // 4. DNS Response από DNS server προς πηγή
            this.dnsManager.visualizeDNSQuery(dnsQueryPath.reverse(), dnsServerDevice, fromDevice, domain, 'response');
            
            return resolution;
        } else {
            this.uiManager.addLog(`DNS QUERY ΑΠΟΤΥΧΙΑ: Το domain "${domain}" δεν βρέθηκε στον DNS server ${dnsServerDevice.name}`, 'error');
            return null;
        }
    }
    
    toggleSimulation() {
        try {
            const isSimulating = this.simulationManager.toggleSimulation();
            
            if (isSimulating) {
                this.uiManager.buttons.simulate.innerHTML = '<i class="fas fa-stop"></i> Διακοπή Προσομοίωσης';
                this.uiManager.buttons.simulate.classList.add('active');
            } else {
                this.uiManager.buttons.simulate.innerHTML = '<i class="fas fa-play"></i> Προσομοίωση Κυκλοφορίας';
                this.uiManager.buttons.simulate.classList.remove('active');
            }
        } catch (error) {
            alert(error.message);
            this.uiManager.addLog(`Σφάλμα: ${error.message}`, 'error');
        }
    }
    
    // EXTREME DEBUGGING FUNCTION
    debugNetworkState() {
        console.log("=== EXTREME NETWORK DEBUG ===");
        console.log(`Total devices: ${this.deviceManager.devices.length}`);
        console.log(`Total connections: ${this.connectionManager.connections.length}`);
        
        // Check all devices
        this.deviceManager.devices.forEach(device => {
            console.log(`\n--- ${device.name} (${device.type}, ${device.id}) ---`);
            console.log(`IP: ${device.ip}, Gateway: ${device.gateway}`);
            console.log(`Has connections array? ${!!device.connections}`);
            console.log(`Connections array:`, device.connections || 'NO ARRAY');
            
            if (device.connections && Array.isArray(device.connections)) {
                console.log(`Connections count in array: ${device.connections.length}`);
                
                device.connections.forEach(connId => {
                    const conn = this.connectionManager.connections.find(c => c.id === connId);
                    if (conn) {
                        const otherId = conn.device1Id === device.id ? conn.device2Id : conn.device1Id;
                        const otherDevice = this.deviceManager.getDeviceById(otherId);
                        console.log(`  Connection ${connId}: ${device.name} ↔ ${otherDevice ? otherDevice.name : 'UNKNOWN'}`);
                    } else {
                        console.log(`  Connection ${connId}: NOT FOUND IN MANAGER!`);
                    }
                });
            } else {
                console.log(`  WARNING: No valid connections array!`);
                // FIX: Create connections array if missing
                if (!device.connections) {
                    device.connections = [];
                    console.log(`  FIXED: Created empty connections array`);
                }
            }
            
            // Find connections from manager perspective
            const connectionsFromManager = this.connectionManager.connections.filter(conn => 
                conn.device1Id === device.id || conn.device2Id === device.id
            );
            console.log(`Connections from manager: ${connectionsFromManager.length}`);
            
            // Add missing connections to device array
            connectionsFromManager.forEach(conn => {
                if (device.connections && !device.connections.includes(conn.id)) {
                    console.log(`  MISSING: Connection ${conn.id} not in device array! Adding...`);
                    device.connections.push(conn.id);
                }
            });
        });
        
        // Check all connections
        console.log("\n=== ALL CONNECTIONS IN MANAGER ===");
        this.connectionManager.connections.forEach((conn, index) => {
            const device1 = this.deviceManager.getDeviceById(conn.device1Id);
            const device2 = this.deviceManager.getDeviceById(conn.device2Id);
            
            if (device1 && device2) {
                console.log(`${index + 1}. ${device1.name} ↔ ${device2.name} (${conn.id})`);
                
                // Verify both devices have this connection in their arrays
                const d1Has = device1.connections && device1.connections.includes(conn.id);
                const d2Has = device2.connections && device2.connections.includes(conn.id);
                
                if (!d1Has) {
                    console.log(`   WARNING: ${device1.name} missing connection!`);
                    if (device1.connections) {
                        device1.connections.push(conn.id);
                        console.log(`   FIXED: Added to ${device1.name}`);
                    }
                }
                
                if (!d2Has) {
                    console.log(`   WARNING: ${device2.name} missing connection!`);
                    if (device2.connections) {
                        device2.connections.push(conn.id);
                        console.log(`   FIXED: Added to ${device2.name}`);
                    }
                }
            }
        });
        
        // Test path finding
        console.log("\n=== PATH FINDING TESTS ===");
        if (this.deviceManager.devices.length >= 4) {
            const server = this.deviceManager.devices.find(d => d.type === 'server');
            const dns = this.deviceManager.devices.find(d => d.type === 'dns');
            
            if (server && dns) {
                console.log(`Testing path: ${server.name} → ${dns.name}`);
                const path = this.connectionManager.findPathBetweenDevices(server, dns);
                console.log(`Path result:`, path ? path.map(d => d.name).join(' → ') : 'NO PATH');
            }
        }
    }
    
    debugInfo() {
        console.log("=== DEBUG ΣΥΝΔΕΣΕΩΝ ===");
        console.log(`Συνολικές συσκευές: ${this.deviceManager.devices.length}`);
        console.log(`Global DNS Records:`, this.dnsManager.globalDnsRecords);
        
        this.deviceManager.devices.forEach(device => {
            console.log(`${device.name} (${device.type}):`);
            console.log(`  IP: ${device.ip}, Domain: ${device.domainName || 'N/A'}`);
            console.log(`  DNS Server: ${device.dns ? device.dns[0] : 'N/A'}`);
            console.log(`  Gateway: ${device.gateway || 'N/A'}`);
            console.log(`  Connections array exists: ${!!device.connections}`);
            console.log(`  Connections count: ${device.connections ? device.connections.length : 0}`);
            
            if (device.dnsCache) {
                console.log(`  DNS Cache:`, device.dnsCache);
            }
            if (device.type === 'router') {
                console.log(`  Router WAN: ${device.interfaces.wan.ip}, Gateway: ${device.interfaces.wan.gateway}`);
                console.log(`  Router LAN: ${device.interfaces.lan.ip}, Gateway: ${device.interfaces.lan.gateway}`);
            }
        });
        
        // Run extreme debugging
        this.debugNetworkState();
        
        this.uiManager.addLog("Debug info printed to console (F12 to see)", "info");
    }
    
autoConfigureRouting() {
    console.log('[AUTO ROUTING] Έναρξη αυτόματης δημιουργίας routing tables...');
    
    try {
        // 1. Βρες όλους τους routers
        const routers = this.deviceManager.devices.filter(d => d.type === 'router');
        
        if (routers.length === 0) {
            // Χρησιμοποιούμε το uiManager για logging
            this.uiManager.addLog('❌ Δεν υπάρχουν routers στο δίκτυο', 'error');
            return { success: false, message: 'No routers found' };
        }
        
        this.uiManager.addLog(`🚀 Αυτόματη δημιουργία routing tables για ${routers.length} routers...`, 'info');
        
        let totalRoutesCreated = 0;
        let configuredRouters = [];
        
        // 2. Για κάθε router
        routers.forEach(router => {
            console.log(`[AUTO ROUTING] Δημιουργία routing table για ${router.name}...`);
            
            // Χρήση της νέας μεθόδου autoGenerateRoutesForRouter από το connectionManager
            const routes = this.connectionManager.autoGenerateRoutesForRouter(router);
            
            if (routes && routes.length > 0) {
                totalRoutesCreated += routes.length;
                configuredRouters.push(router.name);
                
                this.uiManager.addLog(`✅ ${router.name}: Δημιουργήθηκαν ${routes.length} routes`, 'success');
                console.log(`[AUTO ROUTING] ${router.name} έχει τώρα ${routes.length} routes`);
                
                // Εμφάνιση των routes στο log για debugging
                routes.forEach((route, index) => {
                    const cidr = window.subnetMaskToCIDR ? 
                        window.subnetMaskToCIDR(route.mask) : '24';
                    console.log(`  ${index+1}. ${route.network}/${cidr} → ${route.gateway} (${route.interface})`);
                });
            }
        });
        
        // 3. Ενημέρωση UI για όλους τους routers
        setTimeout(() => {
            routers.forEach(router => {
                if (this.uiManager && router === this.deviceManager.selectedDevice) {
                    this.uiManager.updateDeviceInfo(router);
                }
            });
        }, 500);
        
        // 4. Αποτέλεσμα
        if (totalRoutesCreated > 0) {
            const message = `🎉 Αυτόματη διαμόρφωση ολοκληρώθηκε! Δημιουργήθηκαν ${totalRoutesCreated} routes στους routers: ${configuredRouters.join(', ')}`;
            this.uiManager.addLog(message, 'success');
            console.log(`[AUTO ROUTING] ${message}`);
            
            // Ενημέρωση όλων των συνδέσεων
            if (this.connectionManager) {
                this.connectionManager.updateAllConnections(this.deviceManager.devices);
            }
            
            return { 
                success: true, 
                routesCreated: totalRoutesCreated,
                routersConfigured: configuredRouters.length,
                routers: configuredRouters 
            };
        } else {
            this.uiManager.addLog('⚠️ Δεν δημιουργήθηκαν νέα routes. Ίσως όλα τα δίκτυα είναι ήδη connected', 'warning');
            return { success: false, message: 'No new routes created' };
        }
        
    } catch (error) {
        console.error('[AUTO ROUTING] Σφάλμα:', error);
        this.uiManager.addLog(`❌ Σφάλμα στην αυτόματη δημιουργία routing: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}    
    // Νέες μέθοδοι για UI
    updateRouterConfig(router) {
        const result = this.deviceManager.updateDeviceConfigFromUI(router);
        
        if (result.success) {
            this.uiManager.addLog(`Ενημερώθηκαν ρυθμίσεις για ${router.name}`, 'success');
            this.connectionManager.updateAllConnections(this.deviceManager.devices);
        } else {
            this.uiManager.addLog(`Σφάλμα: ${result.error}`, 'error');
        }
        return result;
    }
    
    updateDeviceConfig(device) {
        const result = this.deviceManager.updateDeviceConfigFromUI(device);
        
        if (result.success) {
            this.uiManager.addLog(`Ενημερώθηκαν ρυθμίσεις για ${device.name}`, 'success');
            this.connectionManager.updateAllConnections(this.deviceManager.devices);
            this.uiManager.updateDeviceInfo(device);
        } else {
            this.uiManager.addLog(`Σφάλμα: ${result.error}`, 'error');
        }
        return result;
    }
    
    updateRouterDNS(router, buttonId) {
        // Αυτή η λειτουργία τώρα περιλαμβάνεται στο updateDeviceConfig
        return this.updateRouterConfig(router);
    }
    
    updateDeviceDNS(device, buttonId) {
        // Αυτή η λειτουργία τώρα περιλαμβάνεται στο updateDeviceConfig
        return this.updateDeviceConfig(device);
    }
    
    assignDomainName(device) {
        // Αυτή η λειτουργία τώρα περιλαμβάνεται στο updateDeviceConfig
        return this.updateDeviceConfig(device);
    }
    
    addDNSRecord(dnsDevice) {
        const result = this.dnsManager.addDNSRecordFromUI(
            dnsDevice,
            document.getElementById('newDnsDomain'),  // CORRECT ID!
            document.getElementById('newDnsIp')
        );
        
        if (result) {
            this.uiManager.addLog(`Προστέθηκε DNS record: ${result.domain} → ${result.ip} στον ${dnsDevice.name}`, 'success');
            this.uiManager.updateDeviceInfo(dnsDevice);
        }
        return result;
    }
    
    removeDNSRecord(dnsDevice, domain) {
        if (confirm(`Θέλετε να διαγράψετε το DNS record για το domain "${domain}";`)) {
            const result = this.dnsManager.removeDNSRecordFromUI(dnsDevice, domain);
            if (result) {
                this.uiManager.addLog(`Διαγράφηκε DNS record: ${domain}`, 'info');
                this.uiManager.updateDeviceInfo(dnsDevice);
            }
            return result;
        }
        return false;
    }
    
    removeConnectionById(connId) {
        const result = this.connectionManager.removeConnectionById(connId);
        if (result) {
            this.connectionManager.updateAllConnections(this.deviceManager.devices);
            this.uiManager.addLog('Διαγράφηκε σύνδεση', 'info');
        }
        return result;
    }
    
    removeDevice(device) {
        const result = this.connectionManager.removeDevice(device);
        if (result) {
            this.deviceManager.removeDevice(device);
            this.connectionManager.updateAllConnections(this.deviceManager.devices);
            this.uiManager.addLog(`Αφαιρέθηκε συσκευή: ${device.name}`, 'info');
        }
        return result;
    }
}

// Αρχικοποίηση εφαρμογής όταν φορτωθεί η σελίδα
document.addEventListener('DOMContentLoaded', async function() {
    // Δημιουργία instance του simulator
    const simulator = new NetworkSimulator();
    window.simulator = simulator;
    
    // Εξαγωγή συναρτήσεων για χρήση από buttons
    window.createPredefinedLan = () => simulator.createPredefinedLan();
    window.createPredefinedWan = () => simulator.createPredefinedWan();
    window.clearWorkspace = () => simulator.clearWorkspace();
    window.toggleSimulation = () => simulator.toggleSimulation();
    window.testPingBetweenDevices = () => simulator.testPingBetweenDevices();
    window.testAutoDNS = () => simulator.testAutoDNS();
    window.debugInfo = () => simulator.debugInfo();
    window.autoConfigureRouting = () => simulator.autoConfigureRouting();
    
    
    // Αρχικοποίηση
    try {
        await simulator.initialize();
        console.log("Network Simulator loaded successfully!");
    } catch (error) {
        console.error("Error initializing Network Simulator:", error);
        alert("Σφάλμα κατά την αρχικοποίηση του προσομοιωτή. Ελέγξτε την κονσόλα για λεπτομέρειες.");
    }
});

// ===== WORKSPACE MANAGER INITIALIZATION =====
// Add this at the END of your main.js, AFTER the DOMContentLoaded event

// Initialize workspace manager when simulator is ready
function initializeWorkspaceManager() {
    if (window.simulator && typeof WorkspaceManager !== 'undefined' && !window.workspaceManager) {
        try {
            window.workspaceManager = new WorkspaceManager(window.simulator);
            console.log('Workspace Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Workspace Manager:', error);
        }
    } else if (!window.simulator) {
        console.log('Simulator not ready, waiting...');
        setTimeout(initializeWorkspaceManager, 500);
    } else if (typeof WorkspaceManager === 'undefined') {
        console.log('WorkspaceManager class not loaded, waiting...');
        setTimeout(initializeWorkspaceManager, 500);
    }
}

// Start initialization after everything loads
window.addEventListener('load', () => {
    setTimeout(initializeWorkspaceManager, 1000);
});

// Optional: Add CSS for notifications
if (!document.querySelector('#workspace-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'workspace-notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
}
