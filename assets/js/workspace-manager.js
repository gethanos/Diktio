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
    exportWorkspace(name = "My Network") {
        const devices = this.simulator.deviceManager.devices || [];
        const connections = this.simulator.connectionManager.connections || [];
        
        return {
            metadata: {
                name: name,
                exportDate: new Date().toISOString(),
                version: "2.0",
                app: "Network Simulator",
                deviceCount: devices.length,
                connectionCount: connections.length
            },
            devices: devices.map(device => {
                // Create a clean device object without circular references
                const deviceData = {
                    id: device.id,
                    type: device.type,
                    name: device.name,
                    x: device.x,
                    y: device.y,
                    color: this.getColorForDeviceType(device.type),
                    // Network properties
                    ip: device.ip,
                    subnetMask: device.subnetMask,
                    gateway: device.gateway,
                    dns: device.dns,
                    domainName: device.domainName,
                    status: device.status,
                    // Router specific
                    interfaces: device.interfaces ? {...device.interfaces} : undefined,
                    routingTable: device.routingTable ? [...device.routingTable] : undefined,
                    // Other
                    connections: device.connections ? [...device.connections] : []
                };
                
                return deviceData;
            }),
            connections: connections.map(conn => {
                return {
                    id: conn.id,
                    device1Id: conn.device1Id,
                    device2Id: conn.device2Id,
                    port1: conn.port1,
                    port2: conn.port2,
                    status: conn.status
                };
            }),
            dnsRecords: this.simulator.dnsManager.globalDnsRecords ? 
                {...this.simulator.dnsManager.globalDnsRecords} : {}
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

    // Load workspace from file
    async loadFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (!importData.devices) {
                    throw new Error('Invalid workspace file: No devices found');
                }

                // Check version compatibility
                if (importData.metadata && importData.metadata.version) {
                    const savedVersion = importData.metadata.version;
                    const currentVersion = "2.0";
                    
                    if (savedVersion !== currentVersion) {
                        console.warn(`Version mismatch: Saved ${savedVersion}, Current ${currentVersion}`);
                        if (!confirm(`This workspace was saved with version ${savedVersion} (current: ${currentVersion}).\n\nSome features may not work correctly. Continue loading?`)) {
                            return;
                        }
                    }
                }

                // Ask for confirmation
                if (!confirm('Load this workspace? Current work will be lost.')) {
                    return;
                }

                // Reset UI manager modes BEFORE clearing workspace
                this.resetUIModes();
                
                // Close properties panel before loading
                this.closePropertiesPanel();
                
                // Clear current workspace
                this.simulator.clearWorkspace();
                
                // Give time for cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Restore devices with proper colors
                const restoredDevices = [];
                for (const deviceData of importData.devices) {
                    const device = await this.restoreDevice(deviceData);
                    if (device) {
                        restoredDevices.push(device);
                    }
                }

                // Wait for devices to be fully created
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Restore connections
                if (importData.connections) {
                    for (const connData of importData.connections) {
                        await this.restoreConnection(connData);
                    }
                }
                
                // Καθαρισμός διπλότυπων συνδέσεων
                setTimeout(() => {
                    this.cleanupDuplicateConnections();
                    
                    // Ενημέρωση όλων των συνδέσεων
                    if (this.simulator.connectionManager.updateAllConnections) {
                        this.simulator.connectionManager.updateAllConnections(
                            this.simulator.deviceManager.devices
                        );
                    }
                }, 800);
                
                // Restore DNS records
                if (importData.dnsRecords) {
                    Object.assign(this.simulator.dnsManager.globalDnsRecords, importData.dnsRecords);
                }
                
                // IMPORTANT: Update connection status after everything is loaded
                setTimeout(() => {
                    if (this.simulator.connectionManager) {
                        this.simulator.connectionManager.updateAllConnections(
                            this.simulator.deviceManager.devices
                        );
                    }
                }, 500);
                
                // IMPORTANT: Force update UI manager's device cache
                if (this.simulator.uiManager.updateDeviceInfo) {
                    // Call with null to clear any stale selection
                    this.simulator.uiManager.updateDeviceInfo(null);
                }
                
                // Ensure properties panel stays closed
                this.closePropertiesPanel();
                
                // Update network stats
                if (this.simulator.uiManager.updateNetworkStats) {
                    this.simulator.uiManager.updateNetworkStats();
                }
                
                console.log(`[WORKSPACE] Successfully loaded ${restoredDevices.length} devices, ${importData.connections?.length || 0} connections`);
                this.showNotification(`"${importData.metadata?.name || 'Workspace'}" loaded successfully!`, 'success');
                
            } catch (error) {
                console.error('Load error:', error);
                this.showNotification(`Error loading: ${error.message}`, 'error');
            }
        };

        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
        };

        reader.readAsText(file);
        event.target.value = '';
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

    // Restore a single device
    async restoreDevice(deviceData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    // Create device using existing UI method with the SAME COLOR from saved data
                    const color = deviceData.color || this.getColorForDeviceType(deviceData.type);
                    const device = this.simulator.uiManager.addDeviceToWorkspace(
                        deviceData.type, 
                        color
                    );
                    
                    if (device) {
                        // Set position
                        device.x = deviceData.x || 0;
                        device.y = deviceData.y || 0;
                        
                        if (device.element) {
                            device.element.style.left = `${device.x}px`;
                            device.element.style.top = `${device.y}px`;
                            
                            // Apply the saved color to the element
                            if (color && device.element.style) {
                                device.element.style.borderTopColor = color;
                                device.element.style.borderColor = color;
                            }
                        }
                        
                        // Restore properties
                        device.id = deviceData.id || device.id;
                        device.name = deviceData.name || device.name;
                        
                        // Network properties
                        if (deviceData.ip) device.ip = deviceData.ip;
                        if (deviceData.subnetMask) device.subnetMask = deviceData.subnetMask;
                        if (deviceData.gateway) device.gateway = deviceData.gateway;
                        if (deviceData.dns) device.dns = deviceData.dns;
                        if (deviceData.domainName) device.domainName = deviceData.domainName;
                        if (deviceData.status) device.status = deviceData.status;
                        
                        // Router specific - CRITICAL: Ensure interfaces are valid
                        if (device.type === 'router') {
                            if (deviceData.interfaces) {
                                device.interfaces = deviceData.interfaces;
                            } else {
                                // Initialize router interfaces if not saved
                                device.interfaces = device.interfaces || {
                                    wan: { ip: 'N/A', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] },
                                    lan: { ip: '192.168.1.1', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] }
                                };
                            }
                            
                            // Ensure both interfaces exist and have required properties
                            if (!device.interfaces.wan) {
                                device.interfaces.wan = { ip: 'N/A', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] };
                            }
                            if (!device.interfaces.lan) {
                                device.interfaces.lan = { ip: '192.168.1.1', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] };
                            }
                            
                            // Ensure all required fields exist
                            device.interfaces.wan = {
                                ip: device.interfaces.wan.ip || 'N/A',
                                subnetMask: device.interfaces.wan.subnetMask || '255.255.255.0',
                                gateway: device.interfaces.wan.gateway || '0.0.0.0',
                                dns: device.interfaces.wan.dns || []
                            };
                            device.interfaces.lan = {
                                ip: device.interfaces.lan.ip || '192.168.1.1',
                                subnetMask: device.interfaces.lan.subnetMask || '255.255.255.0',
                                gateway: device.interfaces.lan.gateway || '0.0.0.0',
                                dns: device.interfaces.lan.dns || []
                            };
                        }
                        
                        if (deviceData.routingTable) device.routingTable = deviceData.routingTable;
                        
                        // Restore connections array
                        if (deviceData.connections) device.connections = deviceData.connections;
                        
                        // CRITICAL: Register domain name in DNS if it exists
                        if (device.domainName && device.ip && device.ip !== 'N/A' && device.ip !== '0.0.0.0') {
                            if (this.simulator.dnsManager) {
                                // Check if domain already exists in DNS records
                                if (!this.simulator.dnsManager.globalDnsRecords[device.domainName]) {
                                    this.simulator.dnsManager.globalDnsRecords[device.domainName] = device.ip;
                                    console.log(`[WORKSPACE] Registered domain ${device.domainName} → ${device.ip}`);
                                } else if (this.simulator.dnsManager.globalDnsRecords[device.domainName] !== device.ip) {
                                    console.warn(`[WORKSPACE] Domain ${device.domainName} already exists with different IP: ${this.simulator.dnsManager.globalDnsRecords[device.domainName]} vs ${device.ip}`);
                                }
                            }
                        }
                        
                        // Force update IP display immediately
                        this.updateDeviceDisplay(device, deviceData);
                        
                        // Ensure device is not selected (as requested)
                        if (device.element) {
                            device.element.classList.remove('selected');
                        }
                        
                        resolve(device);
                    } else {
                        console.error('[WORKSPACE] Failed to create device:', deviceData.type);
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error restoring device:', error, deviceData);
                    resolve(null);
                }
            }, 50);
        });
    }

    // Update device display with saved data - SIMPLIFIED VERSION
    updateDeviceDisplay(device, deviceData) {
        if (!device.element) return;
        
        console.log(`[WORKSPACE] Updating display for ${device.name}`);
        
        // Update IP display
        const ipElement = device.element.querySelector('.device-ip');
        if (ipElement) {
            if (device.type === 'router' && deviceData.interfaces) {
                // Special handling for router with multiple interfaces
                const wanIP = deviceData.interfaces.wan?.ip || 'N/A';
                const lanIP = deviceData.interfaces.lan?.ip || 'N/A';
                ipElement.innerHTML = `WAN: ${wanIP}<br>LAN: ${lanIP}`;
            } else {
                ipElement.textContent = deviceData.ip || 'N/A';
            }
        }
        
        // Update name display if exists
        const nameElement = device.element.querySelector('.device-name');
        if (nameElement && deviceData.name) {
            nameElement.textContent = deviceData.name;
        }
        
        // DO NOT add event handlers here - they're already added by devices.js
        // when addDeviceToWorkspace was called
        console.log(`[WORKSPACE] Display updated for ${device.name}, handlers already set by devices.js`);
    }

    // Restore a single connection
    async restoreConnection(connData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const device1 = this.simulator.deviceManager.getDeviceById(connData.device1Id);
                    const device2 = this.simulator.deviceManager.getDeviceById(connData.device2Id);
                    
                    if (device1 && device2) {
                        // ***** ΑΛΛΑΓΗ ΕΔΩ - ΜΗΝ ΚΑΛΕΙΣ createConnection() *****
                        
                        // Έλεγχος αν υπάρχει ήδη σύνδεση με αυτό το ID
                        const existingConnection = this.simulator.connectionManager.connections.find(
                            c => c.id === connData.id
                        );
                        
                        if (existingConnection) {
                            console.log(`[WORKSPACE] Σύνδεση υπάρχει ήδη: ${connData.id} (${device1.name} ↔ ${device2.name})`);
                            resolve();
                            return;
                        }
                        
                        // Έλεγχος αν υπάρχει ήδη σύνδεση μεταξύ αυτών των συσκευών
                        const existingPairConnection = this.simulator.connectionManager.connections.find(conn => 
                            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
                            (conn.device1Id === device2.id && conn.device2Id === device1.id)
                        );
                        
                        if (existingPairConnection) {
                            console.log(`[WORKSPACE] Σύνδεση μεταξύ ${device1.name} και ${device2.name} υπάρχει ήδη με ID: ${existingPairConnection.id}`);
                            
                            // Ενημέρωσε τα devices να χρησιμοποιούν το σωστό ID
                            if (!device1.connections) device1.connections = [];
                            if (!device2.connections) device2.connections = [];
                            
                            // Αφαίρεση λανθασμένων IDs
                            device1.connections = device1.connections.filter(id => 
                                id === existingPairConnection.id || !id.includes('conn_')
                            );
                            device2.connections = device2.connections.filter(id => 
                                id === existingPairConnection.id || !id.includes('conn_')
                            );
                            
                            // Προσθήκη του σωστού ID
                            if (!device1.connections.includes(existingPairConnection.id)) {
                                device1.connections.push(existingPairConnection.id);
                            }
                            if (!device2.connections.includes(existingPairConnection.id)) {
                                device2.connections.push(existingPairConnection.id);
                            }
                            
                            resolve();
                            return;
                        }
                        
                        // Δημιουργία νέας σύνδεσης με το ID από το JSON
                        const connection = {
                            id: connData.id,  // ΚΡΑΤΑΜΕ ΤΟ ΙΔΙΟ ID ΑΠΟ ΤΟ JSON
                            device1Id: device1.id,
                            device2Id: device2.id,
                            type: connData.type || 'direct',
                            canCommunicate: connData.canCommunicate !== false,
                            timestamp: connData.timestamp || new Date().toISOString(),
                            port1: connData.port1,
                            port2: connData.port2,
                            status: connData.status || 'connected'
                        };
                        
                        // Προσθήκη στον connection manager
                        this.simulator.connectionManager.connections.push(connection);
                        
                        // Ενημέρωση των συσκευών
                        if (!device1.connections) device1.connections = [];
                        if (!device2.connections) device2.connections = [];
                        
                        // Προσθήκη του σωστού ID
                        if (!device1.connections.includes(connData.id)) {
                            device1.connections.push(connData.id);
                        }
                        if (!device2.connections.includes(connData.id)) {
                            device2.connections.push(connData.id);
                        }
                        
                        console.log(`[WORKSPACE] Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name} (ID: ${connData.id})`);
                        
                        // Ενημέρωση UI για τη σύνδεση
                        this.simulator.connectionManager.updateConnectionsVisual();
                        
                        // ***** ΤΕΛΟΣ ΑΛΛΑΓΩΝ *****
                    } else {
                        console.warn(`[WORKSPACE] Failed to restore connection: Devices not found (${connData.device1Id}, ${connData.device2Id})`);
                    }
                } catch (error) {
                    console.warn('Failed to restore connection:', error, connData);
                }
                resolve();
            }, 50);
        });
    }

    // Μέθοδος για καθαρισμό διπλότυπων συνδέσεων
    cleanupDuplicateConnections() {
        console.log('[WORKSPACE] Εκκαθάριση διπλότυπων συνδέσεων...');
        
        if (!this.simulator.connectionManager || !this.simulator.connectionManager.connections) {
            return;
        }
        
        const uniqueConnections = [];
        const seenPairs = new Set();
        const removedConnections = [];
        
        // Διάσχιση όλων των συνδέσεων
        this.simulator.connectionManager.connections.forEach(connection => {
            const pairKey = [connection.device1Id, connection.device2Id].sort().join('|');
            
            if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                uniqueConnections.push(connection);
            } else {
                // Αυτή είναι διπλότυπη - θα την αφαιρέσουμε
                removedConnections.push(connection.id);
                
                // Αφαίρεση από τα devices
                const device1 = this.simulator.deviceManager.getDeviceById(connection.device1Id);
                const device2 = this.simulator.deviceManager.getDeviceById(connection.device2Id);
                
                if (device1 && device1.connections) {
                    device1.connections = device1.connections.filter(id => id !== connection.id);
                }
                
                if (device2 && device2.connections) {
                    device2.connections = device2.connections.filter(id => id !== connection.id);
                }
            }
        });
        
        // Ενημέρωση της λίστας συνδέσεων
        this.simulator.connectionManager.connections = uniqueConnections;
        
        // Ενημέρωση UI
        this.simulator.connectionManager.updateConnectionsVisual();
        
        console.log(`[WORKSPACE] Αφαιρέθηκαν ${removedConnections.length} διπλότυπες συνδέσεις:`, removedConnections);
        console.log(`[WORKSPACE] Μείναν ${uniqueConnections.length} μοναδικές συνδέσεις`);
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
