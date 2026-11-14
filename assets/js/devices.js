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
import { isValidIP, isValidHostname, isValidSubnetMask, isOnLink, isUsableHostAddress, generateRandomIP, getNetworkAddress } from './network-core.js';
import { FIREWALL_PORTS, createFirewallConfig, createRule, validateRule } from './firewall.js';

// Διαχείριση συσκευών
class DeviceManager {
    constructor() {
        this.devices = [];
        this.deviceCounter = 1;
        this.selectedDevice = null;
    }

    // Προσθήκη νέας συσκευής
    addDevice(type, color, x, y, workspaceEl) {
        const deviceId = `device-${this.deviceCounter++}`;
        const deviceName = `${window.CONFIG.DEVICE_TYPES[type].name} ${this.deviceCounter-1}`;
        
        // Δημιουργία στοιχείου συσκευής
        const deviceEl = this.createDeviceElement(deviceId, deviceName, type, color, x, y);
        workspaceEl.appendChild(deviceEl);
        
        // Δημιουργία αντικειμένου συσκευής
        const device = this.createDeviceObject(deviceId, type, deviceName, x, y, deviceEl);
        this.devices.push(device);
        
        // Προσθήκη event listeners
        this.addDeviceEventListeners(deviceEl, device);
        
        // Επιλογή συσκευής
        this.selectDevice(device);
        
        return device;
    }
    
    // Δημιουργία DOM element συσκευής
    createDeviceElement(deviceId, deviceName, type, color, x, y) {
        const deviceEl = document.createElement('div');
        deviceEl.className = 'device';
        deviceEl.id = deviceId;
        deviceEl.style.left = `${x}px`;
        deviceEl.style.top = `${y}px`;
        deviceEl.style.backgroundColor = color;
        deviceEl.style.color = 'white';
        deviceEl.style.border = `3px solid ${this.darkenColor(color, 20)}`;
        
        // Προσθήκη περιεχομένου με βάση τον τύπο
        const deviceInfo = window.CONFIG.DEVICE_TYPES[type];
        deviceEl.innerHTML = `
            <i class="${deviceInfo.icon}"></i>
            <div class="device-name">${deviceName}</div>
            <div class="device-ip">${this.getDefaultIPDisplay(type)}</div>
        `;
        
        return deviceEl;
    }
    
    // Δημιουργία αντικειμένου συσκευής
    createDeviceObject(deviceId, type, deviceName, x, y, element) {
        let device;
        
        switch(type) {
            case 'router':
                device = this.createRouterDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'switch':
                device = this.createSwitchDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'cloud':
                device = this.createCloudDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'dns':
                device = this.createDNSDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'firewall':
                // IP διαχείρισης όπως ένας host, δύο θύρες (inside/outside) και κανόνες
                device = {
                    ...this.createStandardDevice(deviceId, type, deviceName, x, y, element),
                    connectionInterfaces: {},
                    firewall: createFirewallConfig()
                };
                break;
            default:
                device = this.createStandardDevice(deviceId, type, deviceName, x, y, element);
        }
        
        return device;
    }
    
    // Δημιουργία Router συσκευής - ΣΥΜΒΑΤΗ ΜΕ ΚΑΙ ΤΑ ΔΥΟ (lan ΚΑΙ lan1/lan2)
    createRouterDevice(deviceId, type, deviceName, x, y, element) {
        const router = {
            id: deviceId,
            type: type,
            name: deviceName,
            interfaces: {
                wan: { 
                    ip: 'N/A', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['8.8.8.8']
                },
                // ΠΑΡΑΚΑΤΩ: Κρατάμε και το παλιό 'lan' ΓΙΑ ΣΥΜΒΑΤΟΤΗΤΑ
                lan: { 
                    ip: '192.168.1.1', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['192.168.1.1']
                },
                lan2: { 
                    ip: '192.168.2.1', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['192.168.2.1'],
                    enabled: true
                }
            },
            connectionInterfaces: {},
            routingTable: [],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            isGateway: true,
            hasDuplicateIP: false // Προσθήκη νέου πεδίου
        };
                
        return router;
    }
    
    // Δημιουργία Switch συσκευής
    createSwitchDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: 'N/A',
            subnetMask: '255.255.255.0',
            gateway: '0.0.0.0',
            dns: [],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            hasDuplicateIP: false // Προσθήκη νέου πεδίου
        };
    }
    
    // Δημιουργία Cloud συσκευής
    createCloudDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: '8.8.8.8',
            subnetMask: '255.255.255.0',
            gateway: '0.0.0.0',
            dns: ['8.8.8.8'],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            hasDuplicateIP: false // Προσθήκη νέου πεδίου
        };
    }
    
    // Δημιουργία DNS Server συσκευής
    createDNSDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: '192.168.1.53',
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
            dns: ['192.168.1.53'],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            dnsRecords: {},
            hasDuplicateIP: false // Προσθήκη νέου πεδίου
        };
    }
    
    // Δημιουργία τυπικής συσκευής (computer, server, printer)
    createStandardDevice(deviceId, type, deviceName, x, y, element) {
        const router = this.devices.find(d => d.type === 'router' && isValidIP(d.interfaces.lan.ip));
        const lan = router?.interfaces.lan;
        const subnetMask = lan?.subnetMask ?? '255.255.255.0';
        const ip = lan
            ? this.allocateHostIP(lan.ip, subnetMask)
            : this.allocateHostIP('192.168.1.0', subnetMask);

        return {
            id: deviceId,
            type,
            name: deviceName,
            ip: ip ?? 'N/A',
            subnetMask,
            gateway: lan ? lan.ip : '0.0.0.0',
            dns: lan ? [lan.ip] : ['8.8.8.8'],
            x,
            y,
            element,
            connections: [],
            status: 'online',
            domainName: null,
            dnsCache: {},
            hasDuplicateIP: false
        };
    }
    

    

    
    // Προσθήκη event listeners σε συσκευή
    addDeviceEventListeners(deviceEl, device) {
        deviceEl.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Ειδικά modes → ΜΗΝ ανοίξεις panel
            if (window.uiManager?.connectionMode ||
                window.uiManager?.testMode ||
                window.uiManager?.manualDNSMode) {
                
                // ΜΟΝΟ το mode-specific click, ΧΩΡΙΣ επιπλέον UI effects
                if (window.uiManager.connectionMode) window.uiManager.handleConnectionClick(device);
                if (window.uiManager.testMode) window.uiManager.handleTestModeClick(device);
                if (window.uiManager.manualDNSMode) window.uiManager.handleManualDNSModeClick(device);
                
                return; // ΠΟΤΕ show panel
            }
            
            // Κανονικό click → άνοιγμα panel
            window.handleDeviceClick(device);
            window.showDevicePanel(device);
        });
        
        this.makeDeviceDraggable(deviceEl, device);
    }
    
    // Καθιστά τη συσκευή μετακινήσιμη
makeDeviceDraggable(deviceEl, device) {
    let isDragging = false;
    let offsetX, offsetY;
    let touchStartX, touchStartY;
    let touchMoved = false;

    // Mouse events (unchanged)
    deviceEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        const rect = deviceEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        deviceEl.style.cursor = 'grabbing';
        deviceEl.style.zIndex = '100';
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    const drag = (e) => {
        if (!isDragging) return;
        const workspaceRect = document.getElementById('workspace').getBoundingClientRect();
        let newX = e.clientX - workspaceRect.left - offsetX;
        let newY = e.clientY - workspaceRect.top - offsetY;
        const maxX = workspaceRect.width - 120;
        const maxY = workspaceRect.height - 120;
        device.x = Math.max(0, Math.min(newX, maxX));
        device.y = Math.max(0, Math.min(newY, maxY));
        deviceEl.style.left = `${device.x}px`;
        deviceEl.style.top = `${device.y}px`;
        if (typeof window.updateConnections === 'function') {
            window.updateConnections();
        }
    };

    const stopDrag = () => {
        if (isDragging) {
            isDragging = false;
            deviceEl.style.cursor = 'pointer';
            deviceEl.style.zIndex = '10';
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        }
    };

    // Touch events with tap/drag distinction
    deviceEl.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        isDragging = true;
        touchMoved = false;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        const rect = deviceEl.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        deviceEl.style.cursor = 'grabbing';
        deviceEl.style.zIndex = '100';
        document.addEventListener('touchmove', dragTouch, { passive: false });
        document.addEventListener('touchend', stopDragTouch, { passive: false });
        e.preventDefault();
    }, { passive: false });

    const dragTouch = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        // If moved more than 10px, treat as drag
        if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
            touchMoved = true;
        }
        if (touchMoved) {
            const workspaceRect = document.getElementById('workspace').getBoundingClientRect();
            let newX = touch.clientX - workspaceRect.left - offsetX;
            let newY = touch.clientY - workspaceRect.top - offsetY;
            const maxX = workspaceRect.width - 120;
            const maxY = workspaceRect.height - 120;
            device.x = Math.max(0, Math.min(newX, maxX));
            device.y = Math.max(0, Math.min(newY, maxY));
            deviceEl.style.left = `${device.x}px`;
            deviceEl.style.top = `${device.y}px`;
            if (typeof window.updateConnections === 'function') {
                window.updateConnections();
            }
        }
        e.preventDefault();
    };

    const stopDragTouch = (e) => {
        if (isDragging) {
            isDragging = false;
            deviceEl.style.cursor = 'pointer';
            deviceEl.style.zIndex = '10';
            document.removeEventListener('touchmove', dragTouch, { passive: false });
            document.removeEventListener('touchend', stopDragTouch, { passive: false });
            // If it was a tap (not a drag), trigger click manually
            if (!touchMoved) {
                deviceEl.click();
            }
        }
        if (e) e.preventDefault();
    };
}
    
    // Επιλογή συσκευής
    selectDevice(device) {
        if (this.selectedDevice) {
            this.selectedDevice.element.classList.remove('selected');
        }
        this.selectedDevice = device;
        device.element.classList.add('selected');
        
        // Ενημέρωση πληροφοριών συσκευής
        if (typeof window.updateDeviceInfo === 'function') {
            window.updateDeviceInfo(device);
        }
    }
    
    // Αφαίρεση συσκευής
    removeDevice(device) {
        // Αφαίρεση όλων των συνδέσεων της συσκευής
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            if (typeof window.removeConnectionById === 'function') {
                window.removeConnectionById(connId);
            }
        });
        
        // Αφαίρεση από το DOM
        device.element.remove();
        
        // Αφαίρεση από τη λίστα συσκευών
        const deviceIndex = this.devices.indexOf(device);
        if (deviceIndex !== -1) {
            this.devices.splice(deviceIndex, 1);
        }
        
        // Επαναφορά επιλεγμένης συσκευής
        this.selectedDevice = null;
        
        return device;
    }
    
    // Βοηθητικές συναρτήσεις
    getDefaultIPDisplay(type) {
        switch(type) {
            case 'router': return 'WAN: N/A<br>LAN: 192.168.1.1<br>LAN2: 192.168.2.1';  // Προσθήκη LAN2
            case 'switch': return '<span class="no-ip">Χωρίς IP</span>';
            case 'cloud': return '8.8.8.8';
            case 'dns': return '192.168.1.53';
            default: return '192.168.1.x';
        }
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return "#" + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
    
    // Βρείτε συσκευή με βάση το ID
    getDeviceById(id) {
        return this.devices.find(d => d.id === id);
    }
    
    // Χωρίς παρενέργειες: δεν αλλάζει το αντικείμενο της συσκευής
    getDeviceByIP(ip) {
        if (!isValidIP(ip) || ip === '0.0.0.0') return null;
        return this.devices.find(device => device.type === 'router'
            ? Object.values(device.interfaces).some(iface => iface.ip === ip && iface.enabled !== false)
            : device.ip === ip
        ) ?? null;
    }
    
    // Βρείτε συσκευή με βάση το domain name
    getDeviceByDomain(domain, globalDnsRecords) {
        // Έλεγχος global DNS records
        if (globalDnsRecords && globalDnsRecords[domain]) {
            const ip = globalDnsRecords[domain];
            return this.getDeviceByIP(ip);
        }
        
        // Έλεγχος σε κάθε συσκευή για domain name
        for (const device of this.devices) {
            if (device.domainName === domain) {
                return device;
            }
        }
        
        return null;
    }
    
    // Βρείτε DNS server (πρώτο διαθέσιμο)
    findDNSServer() {
        // Πρώτα βρες DNS server συσκευή
        const dnsDevice = this.devices.find(d => d.type === 'dns');
        if (dnsDevice) return dnsDevice;
        
        // Μετά βρες router με DNS
        const router = this.devices.find(d => d.type === 'router');
        if (router && router.interfaces.lan.dns && router.interfaces.lan.dns.length > 0) {
            const dnsIP = router.interfaces.lan.dns[0];
            return this.getDeviceByIP(dnsIP);
        }
        
        return null;
    }
    
    // ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ ΕΛΕΓΧΟΥ IP - ΜΟΝΟ 0-255 ΤΑ BYTES
    simpleIPCheck(ip) {
        return !ip || ip === 'N/A' || isValidIP(ip);
    }
    

    
    // Ενημέρωση ρυθμίσεων συσκευής (ενιαία μέθοδος)
    updateDeviceConfig(device, configData) {
        try {
            return device.type === 'router'
                ? this.updateRouterConfig(device, configData)
                : this.updateStandardDeviceConfig(device, configData);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Πρώτα επικύρωση όλων, μετά εφαρμογή: ένα σφάλμα δεν αφήνει μισή ρύθμιση.
    updateRouterConfig(router, configData) {
        const fields = {
            wan: { ip: 'wanIp', subnetMask: 'wanSubnet', gateway: 'wanGateway', dns: 'wanDns' },
            lan: { ip: 'lanIp', subnetMask: 'lanSubnet', gateway: 'lanGateway', dns: 'lanDns' },
            lan2: { ip: 'lan2Ip', subnetMask: 'lan2Subnet', gateway: 'lan2Gateway', dns: 'lan2Dns' }
        };

        const next = {};
        for (const [name, keys] of Object.entries(fields)) {
            const current = router.interfaces[name];
            const pick = (key, fallback) => configData[keys[key]] !== undefined ? configData[keys[key]] : fallback;
            next[name] = {
                ...current,
                ip: pick('ip', current.ip),
                subnetMask: pick('subnetMask', current.subnetMask),
                gateway: pick('gateway', current.gateway) || '0.0.0.0',
                dns: configData[keys.dns] === undefined ? current.dns : (configData[keys.dns] ? [configData[keys.dns]] : [])
            };
        }
        if (configData.lan2Enabled !== undefined) next.lan2.enabled = configData.lan2Enabled;

        const active = Object.entries(next).filter(([name, iface]) =>
            iface.ip && iface.ip !== 'N/A' && !(name === 'lan2' && iface.enabled === false));

        for (const [name, iface] of active) {
            const error = this.validateInterfaceConfig(name.toUpperCase(), { ...iface, dns: iface.dns?.[0] });
            if (error) throw new Error(error);
        }

        // Οι διεπαφές ενός router πρέπει να είναι σε διαφορετικά δίκτυα
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                const [nameA, a] = active[i];
                const [nameB, b] = active[j];
                if (isOnLink(b.ip, a.ip, a.subnetMask) || isOnLink(a.ip, b.ip, b.subnetMask)) {
                    throw new Error(`${nameA.toUpperCase()} και ${nameB.toUpperCase()} επικαλύπτονται (${a.ip}/${a.subnetMask}, ${b.ip}/${b.subnetMask})`);
                }
            }
        }

        Object.assign(router.interfaces.wan, next.wan);
        Object.assign(router.interfaces.lan, next.lan);
        Object.assign(router.interfaces.lan2, next.lan2);

        router.element.querySelector('.device-ip').innerHTML =
            `WAN: ${router.interfaces.wan.ip}<br>` +
            `LAN: ${router.interfaces.lan.ip}<br>` +
            `LAN2: ${router.interfaces.lan2.ip}${router.interfaces.lan2.enabled ? '' : ' (ανενεργό)'}`;

        window.connectionManager?.updateAllConnections(this.devices);
        return { success: true, router };
    }
    
    // Ενημέρωση τυπικής συσκευής - Προσθήκη έλεγχου για διπλότυπη IP
updateStandardDeviceConfig(device, configData) {
        const { ip, subnet, gateway, dns, domainName } = configData;
        const ipLabel = device.element?.querySelector('.device-ip');

        if (device.type === 'switch' && (!ip || ip === 'N/A')) {
            Object.assign(device, { ip: 'N/A', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] });
            if (ipLabel) {
                ipLabel.innerHTML = '<span class="no-ip">Χωρίς IP</span>';
                ipLabel.className = 'device-ip no-ip';
            }
        } else {
            const next = {
                ip: ip || device.ip,
                subnetMask: subnet || device.subnetMask,
                gateway: gateway || '0.0.0.0',
                dns: dns === undefined ? device.dns : (dns && dns !== '0.0.0.0' ? [dns] : [])
            };
            const error = this.validateInterfaceConfig(device.name, { ...next, dns: next.dns?.[0] });
            if (error) throw new Error(error);

            Object.assign(device, next);
            if (ipLabel) {
                ipLabel.textContent = device.ip;
                ipLabel.className = 'device-ip';
            }
            if (domainName && domainName.trim() !== '') {
                device.domainName = domainName.trim();
                window.dnsManager?.addDNSRecord(device.domainName, device.ip);
            }
        }

        window.connectionManager?.updateAllConnections(this.devices);
        return { success: true, device };
    }    
// Βοηθητική συνάρτηση για ενημέρωση από UI
updateDeviceConfigFromUI(device) {
    let configData = {};
    
    // Helper function to safely get value without errors
    const getValue = (id, defaultValue) => {
        try {
            const element = document.getElementById(id);
            return element && element.value !== undefined ? element.value : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    };
    
    if (device.type === 'router') {
        configData = {
            wanIp: getValue('routerWanIp', device.interfaces?.wan?.ip || 'N/A'),
            wanSubnet: getValue('routerWanSubnet', device.interfaces?.wan?.subnetMask || '255.255.255.0'),
            wanGateway: getValue('routerWanGateway', device.interfaces?.wan?.gateway || '0.0.0.0'),
            wanDns: getValue('routerWanDns', device.interfaces?.wan?.dns?.[0] || '8.8.8.8'),
            lanIp: getValue('routerLanIp', device.interfaces?.lan?.ip || '192.168.1.1'),
            lanSubnet: getValue('routerLanSubnet', device.interfaces?.lan?.subnetMask || '255.255.255.0'),
            lanGateway: getValue('routerLanGateway', device.interfaces?.lan?.gateway || '0.0.0.0'),
            lanDns: getValue('routerLanDns', device.interfaces?.lan?.dns?.[0] || device.interfaces?.lan?.ip || '192.168.1.1'),
            lan2Ip: getValue('routerLan2Ip', device.interfaces?.lan2?.ip || '192.168.2.1'),
            lan2Subnet: getValue('routerLan2Subnet', device.interfaces?.lan2?.subnetMask || '255.255.255.0'),
            lan2Gateway: getValue('routerLan2Gateway', device.interfaces?.lan2?.gateway || '0.0.0.0'),
            lan2Dns: getValue('routerLan2Dns', device.interfaces?.lan2?.dns?.[0] || device.interfaces?.lan2?.ip || '192.168.2.1'),
            lan2Enabled: document.getElementById('routerLan2Enabled')?.checked ?? device.interfaces?.lan2?.enabled ?? true
        };
        
        console.log('[DeviceManager] Router config from UI:', configData);
        
    } else if (device.type === 'dns') {
        configData = {
            ip: getValue('dnsIp', device.ip || '192.168.1.53'),
            subnet: getValue('dnsSubnet', device.subnetMask || '255.255.255.0'),
            gateway: getValue('dnsGateway', device.gateway || '192.168.1.1'),
            dns: getValue('deviceDns', device.dns?.[0] || device.ip || '192.168.1.53')
        };
        
    } else if (device.type === 'switch') {
        const switchIp = getValue('switchIp', device.ip || 'N/A');
        
        // Ειδική λογική για switches
        if (switchIp === '' || switchIp === 'N/A' || !switchIp) {
            // Unmanaged switch - χωρίς IP
            configData = {
                ip: 'N/A',
                subnet: '255.255.255.0',
                gateway: '0.0.0.0',
                dns: []
            };
        } else {
            // Managed switch - με IP
            configData = {
                ip: switchIp,
                subnet: getValue('switchSubnet', device.subnetMask || '255.255.255.0'),
                gateway: getValue('switchGateway', device.gateway || '0.0.0.0'),
                dns: getValue('switchDns', device.dns?.[0] || '8.8.8.8')
            };
        }
        
        console.log('[DeviceManager] Switch config from UI:', configData);
        
    } else {
        // Standard devices (computer, server, printer, cloud)
        configData = {
            ip: getValue('deviceIp', device.ip || '192.168.1.x'),
            subnet: getValue('deviceSubnet', device.subnetMask || '255.255.255.0'),
            gateway: getValue('deviceGateway', device.gateway || '0.0.0.0'),
            dns: getValue('deviceDns', device.dns?.[0] || '8.8.8.8'),
            domainName: getValue('deviceDomain', device.domainName || '')
        };
        
        console.log('[DeviceManager] Standard device config from UI:', configData);
    }
    
    // ΜΟΝΟ ΕΔΩ: Αν όλοι οι έλεγχοι πέρασαν, αποθήκευσε
    try {
        const result = this.updateDeviceConfig(device, configData);
        
        if (result.success) {
            // Εμφάνιση μηνύματος επιτυχίας
            setTimeout(() => {
                alert(`Ενημερώθηκαν επιτυχώς οι ρυθμίσεις για ${device.name}`);
            }, 100);
        }
        
        return result;
    } catch (error) {
        alert(`Σφάλμα: ${error.message}`);
        return { success: false, error: error.message };
    }
}    
    // Ανάθεση σε LAN2: σωστή για κάθε μάσκα, χωρίς κοινό array dns με τον router
    assignToLAN2(device) {
        if (device.type === 'router') return false;
        const router = this.devices.find(d => d.type === 'router' && d.interfaces.lan2?.enabled);
        const lan2 = router?.interfaces.lan2;
        if (!lan2 || !isValidIP(lan2.ip)) return false;

        const ip = this.allocateHostIP(lan2.ip, lan2.subnetMask);
        if (!ip) return false;

        Object.assign(device, { ip, subnetMask: lan2.subnetMask, gateway: lan2.ip, dns: [...lan2.dns] });
        const ipLabel = device.element?.querySelector('.device-ip');
        if (ipLabel) ipLabel.textContent = ip;
        return true;
    }

    // Όλες οι IP που χρησιμοποιούνται (hosts και διεπαφές routers)
    getUsedIPs() {
        return this.devices.flatMap(device => device.type === 'router'
            ? Object.values(device.interfaces).map(iface => iface.ip)
            : [device.ip]
        ).filter(isValidIP);
    }

    // Ελεύθερη διεύθυνση host στο δίκτυο της διεπαφής (εξαιρεί network/broadcast/κατειλημμένες)
    allocateHostIP(interfaceIP, subnetMask) {
        return generateRandomIP(interfaceIP, subnetMask, this.getUsedIPs());
    }

    // Η ανίχνευση γίνεται στην τοπολογία (ίδιο broadcast domain). Εδώ μόνο η εμφάνιση,
    // μέσω CSS κλάσης, χωρίς inline styles που μετά πρέπει να «επαναφερθούν».
    // style.css: .duplicate-ip-warning { border-color: #ffcc00 !important; ... }
    //            .duplicate-ip-icon { position: absolute; top: -10px; right: -10px; font-size: 20px; z-index: 100; }
    refreshDuplicateIPWarnings() {
        const conflicting = window.connectionManager?.findIPConflicts() ?? new Set();

        this.devices.forEach(device => {
            const wasFlagged = device.hasDuplicateIP;
            device.hasDuplicateIP = conflicting.has(device);
            if (device.hasDuplicateIP && !wasFlagged) {
                window.addLog?.(`ΠΡΟΣΟΧΗ: η ${device.name} έχει διπλότυπη IP στο ίδιο δίκτυο`, 'warning');
            }

            const el = device.element;
            if (!el) return;
            el.classList.toggle('duplicate-ip-warning', device.hasDuplicateIP);
            const icon = el.querySelector('.duplicate-ip-icon');
            if (device.hasDuplicateIP && !icon) {
                const warningIcon = document.createElement('div');
                warningIcon.className = 'duplicate-ip-icon';
                warningIcon.textContent = '⚠️';
                el.appendChild(warningIcon);
            } else if (!device.hasDuplicateIP && icon) {
                icon.remove();
            }
        });
    }

    // Επικύρωση ρυθμίσεων μιας διεπαφής. Επιστρέφει μήνυμα σφάλματος ή null.
    // Κενό/0.0.0.0 gateway σημαίνει «χωρίς gateway» και επιτρέπεται.
    validateInterfaceConfig(label, { ip, subnetMask, gateway, dns }) {
        if (!isValidIP(ip)) return `${label}: μη έγκυρη IP (${ip})`;
        if (!isValidSubnetMask(subnetMask)) return `${label}: μη έγκυρη μάσκα (${subnetMask}), π.χ. 255.255.255.0`;
        if (!isUsableHostAddress(ip, subnetMask)) return `${label}: η ${ip} είναι διεύθυνση δικτύου ή broadcast για ${subnetMask}`;
        if (gateway && gateway !== '0.0.0.0') {
            if (!isValidIP(gateway)) return `${label}: μη έγκυρο gateway (${gateway})`;
            if (!isOnLink(gateway, ip, subnetMask)) return `${label}: το gateway ${gateway} δεν ανήκει στο δίκτυο ${ip}/${subnetMask}`;
            if (gateway === ip) return `${label}: το gateway δεν μπορεί να είναι η ίδια η συσκευή`;
        }
        if (dns && dns !== '0.0.0.0' && !isValidIP(dns)) return `${label}: μη έγκυρος DNS (${dns})`;
        return null;
    }

    // Στατική διαδρομή: το δίκτυο κανονικοποιείται στη διεύθυνση δικτύου, το gateway πρέπει να είναι
    // on-link στη διεπαφή που επιλέχθηκε (ή 0.0.0.0 για απευθείας συνδεδεμένο δίκτυο).
    addRoute(router, { network, mask, gateway, interface: iface, metric = 1 }) {
        const ifaceConfig = router.interfaces[iface];
        if (!ifaceConfig) throw new Error(`Άγνωστη διεπαφή: ${iface}`);
        if (!isValidIP(network)) throw new Error(`Μη έγκυρο δίκτυο: ${network}`);
        if (!isValidSubnetMask(mask, { allowZero: true })) throw new Error(`Μη έγκυρη μάσκα: ${mask}`);
        const nextHop = gateway || '0.0.0.0';
        if (nextHop !== '0.0.0.0') {
            if (!isValidIP(nextHop)) throw new Error(`Μη έγκυρο gateway: ${nextHop}`);
            if (!isOnLink(nextHop, ifaceConfig.ip, ifaceConfig.subnetMask)) {
                throw new Error(`Το gateway ${nextHop} δεν ανήκει στο δίκτυο της ${iface.toUpperCase()} (${ifaceConfig.ip}/${ifaceConfig.subnetMask})`);
            }
        }

        const route = { network: getNetworkAddress(network, mask), mask, gateway: nextHop, interface: iface, metric: Number(metric) || 1 };
        router.routingTable ??= [];
        if (router.routingTable.some(r => r.network === route.network && r.mask === route.mask && r.gateway === route.gateway)) {
            throw new Error('Η διαδρομή υπάρχει ήδη');
        }
        router.routingTable.push(route);
        window.connectionManager?.updateAllConnections(this.devices);
        return route;
    }

    removeRoute(router, index) {
        const [removed] = router.routingTable.splice(index, 1);
        window.connectionManager?.updateAllConnections(this.devices);
        return removed;
    }

    updateFirewallPolicy(firewall, direction, action) {
        if (!['outbound', 'inbound'].includes(direction) || !['allow', 'deny'].includes(action)) {
            throw new Error('Μη έγκυρη πολιτική');
        }
        firewall.firewall.policy[direction] = action;
        window.connectionManager?.updateAllConnections(this.devices);
    }

    addFirewallRule(firewall, values) {
        const rule = createRule(values);
        const error = validateRule(rule);
        if (error) throw new Error(error);
        firewall.firewall.rules.push(rule);
        window.connectionManager?.updateAllConnections(this.devices);
        return rule;
    }

    removeFirewallRule(firewall, index) {
        const [removed] = firewall.firewall.rules.splice(index, 1);
        window.connectionManager?.updateAllConnections(this.devices);
        return removed;
    }

    // Η σειρά μετράει: ο πρώτος κανόνας που ταιριάζει αποφασίζει
    moveFirewallRuleUp(firewall, index) {
        const rules = firewall.firewall.rules;
        if (index <= 0 || index >= rules.length) return;
        [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
        window.connectionManager?.updateAllConnections(this.devices);
    }

    // Συσκευή από αρχείο workspace, πριν αλλάξει οτιδήποτε. Επιστρέφει μήνυμα σφάλματος ή null.
    // Δεκτές είναι μόνο τιμές που μπορεί να παραγάγει και η εφαρμογή, οπότε καμία τιμή του αρχείου
    // δεν μπορεί να γίνει markup όταν εμφανίζεται στο περιβάλλον.
    validateDeviceData(device) {
        const ports = { router: ['wan', 'lan', 'lan2'], firewall: FIREWALL_PORTS };
        const isAddress = value => value === 'N/A' || isValidIP(value);
        const isOptionalIP = value => value === undefined || value === '' || isValidIP(value);
        const isIPList = value => value === undefined || (Array.isArray(value) && value.every(isValidIP));

        if (typeof device.name !== 'string' || !/^[^<>"'`]{1,64}$/.test(device.name)) {
            return 'μη έγκυρο όνομα (1-64 χαρακτήρες, χωρίς < > " \' `)';
        }
        if (!(device.connections ?? []).every(id => typeof id === 'string')) return 'μη έγκυρη λίστα συνδέσεων';
        if (!Object.values(device.connectionInterfaces ?? {}).every(port => (ports[device.type] ?? []).includes(port))) {
            return 'μη έγκυρη διεπαφή σύνδεσης';
        }

        if (device.type === 'router') {
            for (const [name, iface] of Object.entries(device.interfaces ?? {})) {
                if (!ports.router.includes(name)) return `άγνωστη διεπαφή ${String(name).slice(0, 20)}`;
                if (!isAddress(iface?.ip) || (isValidIP(iface.ip) && !isValidSubnetMask(iface.subnetMask)) ||
                    !isOptionalIP(iface.gateway) || !isIPList(iface.dns) ||
                    (iface.enabled !== undefined && typeof iface.enabled !== 'boolean')) {
                    return `μη έγκυρες ρυθμίσεις διεπαφής ${name.toUpperCase()}`;
                }
            }
            const routesValid = (device.routingTable ?? []).every(route =>
                isValidIP(route?.network) && isValidSubnetMask(route.mask, { allowZero: true }) && isValidIP(route.gateway) &&
                (route.interface === undefined || ports.router.includes(route.interface)) &&
                (route.metric === undefined || Number.isFinite(route.metric)));
            return routesValid ? null : 'μη έγκυρη διαδρομή στον πίνακα δρομολόγησης';
        }

        if (!isAddress(device.ip ?? 'N/A') || (isValidIP(device.ip) && !isValidSubnetMask(device.subnetMask)) ||
            !isOptionalIP(device.gateway) || !isIPList(device.dns)) {
            return 'μη έγκυρη IP, μάσκα, gateway ή DNS';
        }
        if (device.domainName != null && !isValidHostname(device.domainName)) return 'μη έγκυρο domain name';

        if (device.firewall !== undefined) {
            const { policy, rules } = device.firewall ?? {};
            const decisions = ['allow', 'deny'];
            if (!decisions.includes(policy?.outbound) || !decisions.includes(policy?.inbound) || !Array.isArray(rules)) {
                return 'μη έγκυρη πολιτική firewall';
            }
            const invalid = rules.find(rule => !rule || typeof rule.source !== 'string' || typeof rule.destination !== 'string' ||
                (rule.port !== null && !Number.isInteger(rule.port)) || validateRule(rule));
            if (invalid) return 'μη έγκυρος κανόνας firewall';
        }
        return null;
    }
}

// Εξαγωγή της κλάσης
export default DeviceManager;
