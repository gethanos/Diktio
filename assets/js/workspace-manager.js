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
                    // ΚΡΙΤΙΚΟ: Αποθήκευση connectionInterfaces για routers
                    connectionInterfaces: device.connectionInterfaces ? {...device.connectionInterfaces} : {},
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
                    status: conn.status,
                    // ΚΡΙΤΙΚΟ: Αποθήκευση interface types αν υπάρχουν
                    interfaceType1: conn.interfaceType1,
                    interfaceType2: conn.interfaceType2
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
                
                // 1. RESTORE DEVICES EXACTLY AS IN JSON
                const restoredDevices = [];
                for (const deviceData of importData.devices) {
                    const device = await this.restoreDevice(deviceData);
                    if (device) {
                        restoredDevices.push(device);
                    }
                }

                // 2. RESTORE CONNECTIONS SIMPLY - JUST ADD TO MANAGER
                if (importData.connections && importData.connections.length > 0) {
                    await this.simpleRestoreConnections(importData);
                }
                
                // 3. Restore DNS records
                if (importData.dnsRecords) {
                    Object.assign(this.simulator.dnsManager.globalDnsRecords, importData.dnsRecords);
                }
                
                // 4. FINAL UPDATE
                setTimeout(() => {
                    if (this.simulator.connectionManager.updateAllConnections) {
                        this.simulator.connectionManager.updateAllConnections(
                            this.simulator.deviceManager.devices
                        );
                    }
                }, 500);
                
                // IMPORTANT: Force update UI manager's device cache
                if (this.simulator.uiManager.updateDeviceInfo) {
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

    // SIMPLE: Restore a single device
    async restoreDevice(deviceData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    // Create device using existing UI method
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
                        
                        // RESTORE ALL PROPERTIES EXACTLY AS IN JSON
                        device.id = deviceData.id || device.id;
                        device.name = deviceData.name || device.name;
                        
                        // Network properties
                        device.ip = deviceData.ip || device.ip;
                        device.subnetMask = deviceData.subnetMask || device.subnetMask;
                        device.gateway = deviceData.gateway || device.gateway;
                        device.dns = deviceData.dns || device.dns;
                        device.domainName = deviceData.domainName || device.domainName;
                        device.status = deviceData.status || device.status;
                        
                        // Router specific
                        if (device.type === 'router') {
                            if (deviceData.interfaces) {
                                device.interfaces = deviceData.interfaces;
                            }
                            
                            // ΚΡΙΤΙΚΟ: Restore connectionInterfaces exactly
                            if (deviceData.connectionInterfaces) {
                                device.connectionInterfaces = { ...deviceData.connectionInterfaces };
                            }
                        }
                        
                        if (deviceData.routingTable) device.routingTable = deviceData.routingTable;
                        
                        // Restore connections array EXACTLY
                        device.connections = deviceData.connections ? [...deviceData.connections] : [];
                        
                        // Force update IP display
                        this.updateDeviceDisplay(device, deviceData);
                        
                        // Ensure device is not selected
                        if (device.element) {
                            device.element.classList.remove('selected');
                        }
                        
                        console.log(`[WORKSPACE] Restored device: ${device.name} with ${device.connections.length} connections`);
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

    // SIMPLE: Just update device display
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
    }

    // SIMPLE: Just add connections to manager without creating new ones
    async simpleRestoreConnections(importData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    console.log('[WORKSPACE] Adding connections to manager...');
                    
                    let addedCount = 0;
                    let skippedCount = 0;
                    
                    importData.connections.forEach(connData => {
                        try {
                            // Check if this connection already exists
                            const existingConn = this.simulator.connectionManager.connections.find(
                                conn => conn.id === connData.id
                            );
                            
                            if (existingConn) {
                                console.log(`[WORKSPACE] Connection already exists: ${connData.id}`);
                                skippedCount++;
                                return;
                            }
                            
                            // Just add the connection object as-is
                            this.simulator.connectionManager.connections.push({
                                id: connData.id,
                                device1Id: connData.device1Id,
                                device2Id: connData.device2Id,
                                port1: connData.port1,
                                port2: connData.port2,
                                status: connData.status || 'connected',
                                interfaceType1: connData.interfaceType1,
                                interfaceType2: connData.interfaceType2
                            });
                            
                            addedCount++;
                            console.log(`[WORKSPACE] Added connection: ${connData.id}`);
                            
                        } catch (error) {
                            console.warn(`[WORKSPACE] Failed to add connection ${connData.id}:`, error);
                            skippedCount++;
                        }
                    });
                    
                    console.log(`[WORKSPACE] Connections added: ${addedCount}, skipped: ${skippedCount}`);
                    
                    // Update visual connections
                    if (this.simulator.connectionManager.updateConnectionsVisual) {
                        this.simulator.connectionManager.updateConnectionsVisual();
                    }
                    
                    resolve();
                } catch (error) {
                    console.error('[WORKSPACE] Error in simpleRestoreConnections:', error);
                    resolve();
                }
            }, 100);
        });
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
