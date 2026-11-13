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
// assets/js/workspace-manager.js
class WorkspaceManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.setupEventListeners();
        console.log('Workspace Manager initialized');
    }

    setupEventListeners() {
        // Save button
        const saveBtn = document.getElementById('saveWorkspaceBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveWorkspace());
        }

        // Load button
        const loadBtn = document.getElementById('loadWorkspaceBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.triggerLoad());
        }

        // File input
        const fileInput = document.getElementById('workspaceFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.loadFromFile(e));
        }
    }

    // Get color for device type
    getColorForDeviceType(type) {
        const config = window.CONFIG || {};
        if (config.DEVICE_TYPES && config.DEVICE_TYPES[type]) {
            return config.DEVICE_TYPES[type].color;
        }
        
        // Default colors if CONFIG not available
        const defaultColors = {
            'router': '#3498db',
            'switch': '#2ecc71', 
            'computer': '#e74c3c',
            'server': '#9b59b6',
            'cloud': '#f39c12',
            'printer': '#34495e',
            'dns': '#9b59b6',
            'firewall': '#e74c3c'
        };
        
        return defaultColors[type] || '#3498db';
    }

    // Close device properties panel
    closePropertiesPanel() {
        const propertiesPanel = document.getElementById('propertiesPanel');
        if (propertiesPanel) {
            propertiesPanel.classList.add('hidden');
        }
        
        // Clear any selected device/connection
        if (this.simulator.deviceManager) {
            this.simulator.deviceManager.selectedDevice = null;
        }
        
        // Clear selection visuals
        const selectedElements = document.querySelectorAll('.selected');
        selectedElements.forEach(el => {
            el.classList.remove('selected');
        });
    }

    // Export current workspace
    exportWorkspace(name = 'My Network') {
        const devices = this.simulator.deviceManager.devices || [];
        const connections = this.simulator.connectionManager.connections || [];

        return {
            metadata: {
                name,
                exportDate: new Date().toISOString(),
                version: '2.0',
                app: 'Network Simulator',
                deviceCount: devices.length,
                connectionCount: connections.length
            },
            devices: devices.map(device => ({
                id: device.id,
                type: device.type,
                name: device.name,
                x: device.x,
                y: device.y,
                color: this.getColorForDeviceType(device.type),
                ip: device.ip,
                subnetMask: device.subnetMask,
                gateway: device.gateway,
                dns: device.dns,
                domainName: device.domainName,
                status: device.status,
                interfaces: device.interfaces,
                routingTable: device.routingTable,
                connectionInterfaces: device.connectionInterfaces || {},
                firewall: device.firewall,
                connections: device.connections || []
            })),
            connections: connections.map(conn => ({
                id: conn.id,
                device1Id: conn.device1Id,
                device2Id: conn.device2Id,
                interface1: conn.interface1,
                interface2: conn.interface2
            })),
            dnsRecords: { ...(this.simulator.dnsManager.globalDnsRecords || {}) }
        };
    }

    // Save workspace to file
    saveWorkspace() {
        try {
            const workspaceName = prompt("Enter a name for your workspace:", "My Network") || "My Network";
            
            const workspaceData = this.exportWorkspace(workspaceName);
            
            // Create and download file
            this.downloadJSON(workspaceData, workspaceName);
            
            this.showNotification(`"${workspaceName}" saved successfully!`, 'success');
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
            console.error('Save error:', error);
        }
    }

    // Download JSON file
    downloadJSON(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const safeFilename = `${filename.replace(/[^a-z0-9]/gi, '_')}.json`;
        
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Επιστρέφει true αν φορτώθηκε, false αν ακυρώθηκε ή απέτυχε
    async loadFromFile(event) {
        const file = event.target.files?.[0];
        if (event.target.value !== undefined) event.target.value = '';
        if (!file) return false;

        try {
            const { data, warnings } = this.validateWorkspace(JSON.parse(await this.readFileAsText(file)));

            const savedVersion = data.metadata?.version;
            if (savedVersion && savedVersion !== '2.0' &&
                !confirm(`This workspace was saved with version ${savedVersion} (current: 2.0).\n\nSome features may not work correctly. Continue loading?`)) {
                return false;
            }
            if (!confirm('Load this workspace? Current work will be lost.')) return false;

            this.applyWorkspace(data, warnings);
            this.showNotification(`"${data.metadata?.name || 'Workspace'}" loaded successfully!`, warnings.length ? 'warning' : 'success');
            return true;
        } catch (error) {
            this.showNotification(`Error loading: ${error.message}`, 'error');
            return false;
        }
    }

    // Reset UI modes before loading
    resetUIModes() {
        if (this.simulator.uiManager) {
            // Reset all modes
            this.simulator.uiManager.connectionMode = false;
            this.simulator.uiManager.testMode = false;
            this.simulator.uiManager.manualDNSMode = false;
            this.simulator.uiManager.firstDeviceForConnection = null;
            this.simulator.uiManager.firstTestDevice = null;
            this.simulator.uiManager.dnsSourceDevice = null;
            
            // Update UI button states
            if (this.simulator.uiManager.buttons.connect) {
                this.simulator.uiManager.buttons.connect.classList.remove('primary');
            }
            if (this.simulator.uiManager.buttons.testRoute) {
                this.simulator.uiManager.buttons.testRoute.classList.remove('primary');
            }
            if (this.simulator.uiManager.buttons.manualDNS) {
                this.simulator.uiManager.buttons.manualDNS.classList.remove('primary');
            }
            
            // Reset mode text
            if (this.simulator.uiManager.setModeText) {
                this.simulator.uiManager.setModeText('Επιλογή Συσκευών');
            }
            
            console.log('[WORKSPACE] UI modes reset');
        }
    }

    // Συγχρονη επαναφορά με το αποθηκευμένο id. Ο μετρητής ρυθμίζεται ώστε
    // η επόμενη νέα συσκευή να μην πάρει id που ήδη υπάρχει.
    restoreDevice(deviceData) {
        const { deviceManager, uiManager } = this.simulator;
        const workspace = uiManager.workspace || document.getElementById('workspace');
        const color = deviceData.color || this.getColorForDeviceType(deviceData.type);
        const device = deviceManager.addDevice(deviceData.type, color, deviceData.x || 0, deviceData.y || 0, workspace);

        Object.assign(device, {
            id: deviceData.id,
            name: deviceData.name ?? device.name,
            status: deviceData.status ?? device.status,
            routingTable: deviceData.routingTable ?? device.routingTable,
            connections: [...(deviceData.connections || [])],
            connectionInterfaces: { ...(deviceData.connectionInterfaces || {}) }
        });
        if (deviceData.firewall) device.firewall = structuredClone(deviceData.firewall);
        if (device.type === 'router') {
            device.interfaces = structuredClone(deviceData.interfaces);
        } else {
            ['ip', 'subnetMask', 'gateway', 'domainName'].forEach(key => {
                if (deviceData[key] !== undefined) device[key] = deviceData[key];
            });
            if (Array.isArray(deviceData.dns)) device.dns = [...deviceData.dns];
        }

        device.element.id = device.id;
        device.element.classList.remove('selected');
        deviceManager.selectedDevice = null;
        this.updateDeviceDisplay(device);

        const numericId = Number(device.id.match(/^device-(\d+)$/)?.[1]);
        if (numericId >= deviceManager.deviceCounter) deviceManager.deviceCounter = numericId + 1;
        return device;
    }

    // SIMPLE: Just update device display
    updateDeviceDisplay(device) {
        const ipElement = device.element?.querySelector('.device-ip');
        if (ipElement) {
            if (device.type === 'router') {
                const { wan, lan, lan2 } = device.interfaces;
                ipElement.innerHTML = `WAN: ${wan.ip}<br>LAN: ${lan.ip}<br>LAN2: ${lan2.ip}${lan2.enabled === false ? ' (ανενεργό)' : ''}`;
            } else {
                ipElement.textContent = device.ip || 'N/A';
            }
        }
        const nameElement = device.element?.querySelector('.device-name');
        if (nameElement) nameElement.textContent = device.name;
    }

    // Οι διεπαφές routers/firewalls προκύπτουν από τα αποθηκευμένα connectionInterfaces. Για αρχεία
    // χωρίς αυτά συμπληρώνονται: router με determineInterfaceForConnection, firewall με την πρώτη ελεύθερη θύρα.
    simpleRestoreConnections(importData) {
        const { connectionManager, deviceManager } = this.simulator;
        (importData.connections || []).forEach(connData => {
            if (connectionManager.connections.some(conn => conn.id === connData.id)) return;
            const connection = {
                id: connData.id,
                device1Id: connData.device1Id,
                device2Id: connData.device2Id,
                type: 'direct',
                canCommunicate: true
            };
            ['device1Id', 'device2Id'].forEach((key, index) => {
                const device = deviceManager.getDeviceById(connData[key]);
                if (device?.type !== 'router' && device?.type !== 'firewall') return;
                const iface = connData[`interface${index + 1}`]
                    ?? device.connectionInterfaces[connData.id]
                    ?? (device.type === 'router'
                        ? connectionManager.determineInterfaceForConnection(device, connection)
                        : ['inside', 'outside'].find(port => !Object.values(device.connectionInterfaces).includes(port)));
                if (!iface) return;
                device.connectionInterfaces[connData.id] = iface;
                connection[`interface${index + 1}`] = iface;
            });
            connectionManager.connections.push(connection);
        });
        connectionManager.updateConnectionsVisual();
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    // Ολόκληρος ο έλεγχος γίνεται ΠΡΙΝ καθαριστεί το τρέχον workspace.
    // Σφάλματα συσκευών ακυρώνουν τη φόρτωση. Συνδέσεις προς ανύπαρκτες συσκευές
    // (υπάρχουν στα Simple_Lan.json, predefined-lan.json) αφαιρούνται με προειδοποίηση.
    // Επιστρέφει { data, warnings } με καθαρισμένα δεδομένα, χωρίς να αλλάζει το αρχικό.
    validateWorkspace(data) {
        if (!data || !Array.isArray(data.devices)) {
            throw new Error('Μη έγκυρο αρχείο: λείπει ο πίνακας "devices"');
        }
        const knownTypes = Object.keys(window.CONFIG?.DEVICE_TYPES || {});
        const ids = new Set();

        data.devices.forEach((device, index) => {
            if (typeof device.id !== 'string' || ids.has(device.id)) {
                throw new Error(`Μη έγκυρο αρχείο: η συσκευή #${index + 1} δεν έχει id ή το id της επαναλαμβάνεται`);
            }
            ids.add(device.id);
            if (!knownTypes.includes(device.type)) {
                throw new Error(`Μη έγκυρο αρχείο: άγνωστος τύπος συσκευής "${device.type}"`);
            }
            if (device.type === 'router' && !(device.interfaces?.wan && (device.interfaces.lan || device.interfaces.lan1))) {
                throw new Error(`Μη έγκυρο αρχείο: ο router "${device.name || device.id}" δεν έχει διεπαφές WAN/LAN`);
            }
        });

        const warnings = [];
        const connectionIds = new Set();
        const connections = (data.connections || []).filter(conn => {
            if (connectionIds.has(conn.id)) throw new Error(`Μη έγκυρο αρχείο: διπλότυπο id σύνδεσης ${conn.id}`);
            connectionIds.add(conn.id);
            if (ids.has(conn.device1Id) && ids.has(conn.device2Id)) return true;
            warnings.push(`Η σύνδεση ${conn.id} αναφέρεται σε συσκευή που δεν υπάρχει και παραλείφθηκε`);
            return false;
        });
        const validIds = new Set(connections.map(conn => conn.id));
        const devices = data.devices.map(device => ({
            ...device,
            connections: (device.connections || []).filter(id => validIds.has(id)),
            connectionInterfaces: Object.fromEntries(
                Object.entries(device.connectionInterfaces || {}).filter(([id]) => validIds.has(id)))
        }));

        return { data: { ...data, devices, connections }, warnings };
    }

    // Παλιά αρχεία: interfaces.lan1 → lan, απουσία lan2
    normalizeDeviceData(deviceData) {
        if (deviceData.type !== 'router') return deviceData;
        const { lan1, ...interfaces } = deviceData.interfaces;
        interfaces.lan ??= lan1;
        interfaces.lan2 ??= { ip: 'N/A', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [], enabled: false };
        return { ...deviceData, interfaces };
    }

    // Κοινή διαδρομή επαναφοράς για ήδη ελεγμένα δεδομένα (από validateWorkspace)
    applyWorkspace(data, warnings = []) {
        const { deviceManager, connectionManager, dnsManager, uiManager } = this.simulator;

        this.resetUIModes();
        this.closePropertiesPanel();
        this.simulator.clearWorkspace();

        data.devices.map(d => this.normalizeDeviceData(d)).forEach(d => this.restoreDevice(d));
        this.simpleRestoreConnections(data);
        Object.assign(dnsManager.globalDnsRecords, data.dnsRecords || {});

        connectionManager.updateAllConnections(deviceManager.devices);
        deviceManager.refreshDuplicateIPWarnings?.();
        this.closePropertiesPanel();
        uiManager.updateDeviceInfo?.(null);
        uiManager.updateNetworkStats?.();
        warnings.forEach(warning => uiManager.addLog?.(warning, 'warning'));
    }

    triggerLoad() {
        document.getElementById('workspaceFileInput').click();
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3',
            warning: '#f39c12'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: fadeIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add CSS for notifications if not already added
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

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkspaceManager;
}

// Auto-initialize when simulator is available
function initializeWorkspaceManager() {
    if (window.simulator && typeof WorkspaceManager !== 'undefined' && !window.workspaceManager) {
        try {
            window.workspaceManager = new WorkspaceManager(window.simulator);
            console.log('Workspace Manager auto-initialized');
        } catch (error) {
            console.error('Failed to auto-initialize Workspace Manager:', error);
        }
    }
}

// Try to initialize after a delay
setTimeout(initializeWorkspaceManager, 2000);
