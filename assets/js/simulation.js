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
// Διαχείριση προσομοίωσης - ΔΙΟΡΘΩΜΕΝΗ ΈΚΔΟΣΗ με INTERNET ACCESS και FIXED PING
import { areInSameNetwork } from './network-core.js';

class SimulationManager {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
        this.isSimulating = false;
        this.packetInterval = null;
        this.activePackets = new Set();
    }
    
    // Έναρξη προσομοίωσης
    startSimulation() {
        if (this.isSimulating) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Η προσομοίωση είναι ήδη ενεργή");
            return;
        }
        
        console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Έναρξη προσομοίωσης κυκλοφορίας...");
        
        // Έλεγχος για συνδέσεις
        if (this.connectionManager.connections.length === 0) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Δεν υπάρχουν συνδέσεις");
            this.addLog('Δεν υπάρχουν συνδέσεις για προσομοίωση', 'warning');
            return;
        }
        
        this.isSimulating = true;
        
        // Καθαρισμός υπάρχοντων πακέτων
        this.stopAllPackets();
        
        // Δημιουργία του πρώτου πακέτου αμέσως
        setTimeout(() => this.generateRandomPacket(), 500);
        
        // Δημιουργία πακέτων σε τακτά διαστήματα
        this.packetInterval = setInterval(() => {
            this.generateRandomPacket();
        }, window.CONFIG.SIMULATION_INTERVAL);
        
        this.addLog('Ξεκίνησε η προσομοίωση κυκλοφορίας', 'success');
    }
    
    // Δημιουργία τυχαίου πακέτου
    generateRandomPacket() {
        const connections = this.connectionManager.connections;
        
        if (connections.length === 0) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Δεν υπάρχουν συνδέσεις");
            return;
        }
        
        // Επιλογή τυχαίας σύνδεσης
        const randomConn = connections[Math.floor(Math.random() * connections.length)];
        
        // Εύρεση των συσκευών της σύνδεσης
        const device1 = window.deviceManager.getDeviceById(randomConn.device1Id);
        const device2 = window.deviceManager.getDeviceById(randomConn.device2Id);
        
        if (!device1 || !device2) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Σφάλμα: Δεν βρέθηκαν συσκευές για τη σύνδεση");
            return;
        }
        
        // Τυχαία επιλογή κατεύθυνσης
        let fromDevice, toDevice;
        if (Math.random() > 0.5) {
            fromDevice = device1;
            toDevice = device2;
        } else {
            fromDevice = device2;
            toDevice = device1;
        }
        
        // Δημιουργία πακέτου ΜΟΝΟ αν οι συσκευές είναι συνδεδεμένες φυσικά
        if (this.connectionManager.areDevicesConnected(fromDevice, toDevice)) {
            this.createSimplePacket(fromDevice, toDevice);
            
            // 30% πιθανότητα για απάντηση
            if (Math.random() < 0.3) {
                setTimeout(() => {
                    this.createSimplePacket(toDevice, fromDevice);
                }, Math.random() * 500 + 200);
            }
        } else {
            console.log(`[ΠΡΟΣΟΜΟΙΩΣΗ] Οι συσκευές ${fromDevice.name} και ${toDevice.name} δεν είναι συνδεδεμένες`);
        }
    }
    
    // Δημιουργία απλού πακέτου (ευθεία γραμμή)
    createSimplePacket(fromDevice, toDevice) {
        if (!fromDevice || !toDevice || fromDevice.id === toDevice.id) {
            return;
        }
        
        const packetId = `packet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        // Χρώμα με βάση τον τύπο συσκευής
        let packetColor = '#e74c3c'; // Default
        switch(fromDevice.type) {
            case 'router': packetColor = '#3498db'; break;
            case 'switch': packetColor = '#2ecc71'; break;
            case 'cloud': packetColor = '#f39c12'; break;
            case 'dns': packetColor = '#9b59b6'; break;
            case 'server': packetColor = '#9b59b6'; break;
            case 'computer': packetColor = '#e74c3c'; break;
            case 'printer': packetColor = '#34495e'; break;
        }
        
        // Δημιουργία στοιχείου
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-animated';
        packetEl.id = packetId;
        packetEl.style.backgroundColor = packetColor;
        packetEl.style.boxShadow = `0 0 8px ${packetColor}`;
        
        // Αρχική θέση (στο κέντρο της πηγής)
        const startX = fromDevice.x + 60;
        const startY = fromDevice.y + 60;
        const endX = toDevice.x + 60;
        const endY = toDevice.y + 60;
        
        packetEl.style.left = `${startX}px`;
        packetEl.style.top = `${startY}px`;
        
        document.getElementById('workspace').appendChild(packetEl);
        
        // Προσθήκη στη λίστα
        this.activePackets.add(packetId);
        
        // Κίνηση
        const startTime = Date.now();
        const duration = 1200 + Math.random() * 800;
        
        const animate = () => {
            if (!packetEl.parentNode) {
                this.activePackets.delete(packetId);
                return;
            }
            
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing για πιο φυσική κίνηση
            const easeProgress = this.easeInOutQuad(progress);
            
            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress;
            
            packetEl.style.left = `${currentX}px`;
            packetEl.style.top = `${currentY}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Αφαίρεση μετά την ολοκλήρωση
                setTimeout(() => {
                    if (packetEl.parentNode) {
                        packetEl.remove();
                    }
                    this.activePackets.delete(packetId);
                }, 200);
            }
        };
        
        requestAnimationFrame(animate);
        
        // Προσθήκη στο log
        const commInfo = this.connectionManager.canDevicesCommunicateDirectly(fromDevice, toDevice);
        const viaText = commInfo.viaGateway ? ' (μέσω Gateway)' : '';
        this.addLog(`Πακέτο: ${fromDevice.name} → ${toDevice.name}${viaText}`, 'info');
    }
    
    // Easing function
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    // Διακοπή προσομοίωσης
    stopSimulation() {
        if (!this.isSimulating) return;
        
        console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Διακοπή προσομοίωσης...");
        
        this.isSimulating = false;
        if (this.packetInterval) {
            clearInterval(this.packetInterval);
            this.packetInterval = null;
        }
        
        // Καθαρισμός πακέτων
        this.stopAllPackets();
        
        this.addLog('Διακόπηκε η προσομοίωση κυκλοφορίας.', 'info');
    }
    
    // Σταμάτημα όλων των πακέτων
    stopAllPackets() {
        document.querySelectorAll('.packet-animated').forEach(el => el.remove());
        this.activePackets.clear();
    }
    
    // Δημιουργία ping πακέτου
    createPingPacket(fromDevice, toDevice, path = null) {
        const packetId = `ping-${Date.now()}`;
        
        if (path && path.length > 2) {
            this.animatePathPacketWithPath(packetId, path, fromDevice, toDevice);
            return;
        } else {
            const startX = fromDevice.x + 60;
            const startY = fromDevice.y + 60;
            const endX = toDevice.x + 60;
            const endY = toDevice.y + 60;
            
            const packetEl = document.createElement('div');
            packetEl.className = 'packet';
            packetEl.id = packetId;
            packetEl.style.left = `${startX - 6}px`;
            packetEl.style.top = `${startY - 6}px`;
            packetEl.style.backgroundColor = '#2ecc71';
            packetEl.style.boxShadow = '0 0 5px #2ecc71';
            
            document.getElementById('workspace').appendChild(packetEl);
            
            const packet = {
                id: packetId,
                fromDeviceId: fromDevice.id,
                toDeviceId: toDevice.id,
                element: packetEl,
                startTime: Date.now(),
                duration: 1000
            };
            
            this.connectionManager.packets.push(packet);
            this.animatePingPacket(packet, startX, startY, endX, endY);
        }
    }
    
    // Κίνηση ping πακέτου
    animatePingPacket(packet, startX, startY, endX, endY) {
        const startTime = packet.startTime;
        const duration = packet.duration;
        
        const updatePosition = () => {
            if (!packet.element || !packet.element.parentNode) return;
            
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            
            packet.element.style.left = `${currentX - 6}px`;
            packet.element.style.top = `${currentY - 6}px`;
            
            if (progress < 1) {
                requestAnimationFrame(updatePosition);
            } else {
                setTimeout(() => {
                    if (packet.element && packet.element.parentNode) {
                        packet.element.remove();
                        const index = this.connectionManager.packets.indexOf(packet);
                        if (index !== -1) {
                            this.connectionManager.packets.splice(index, 1);
                        }
                    }
                }, 200);
            }
        };
        
        requestAnimationFrame(updatePosition);
    }
    
    // Οπτικοποίηση διαδρομής
    visualizePath(path, fromDevice, toDevice) {
        document.querySelectorAll('.path-visual').forEach(el => el.remove());
        
        for (let i = 0; i < path.length - 1; i++) {
            const currentDevice = path[i];
            const nextDevice = path[i + 1];
            
            const x1 = currentDevice.x + 60;
            const y1 = currentDevice.y + 60;
            const x2 = nextDevice.x + 60;
            const y2 = nextDevice.y + 60;
            
            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            const pathSegment = document.createElement('div');
            pathSegment.className = 'path-visual';
            pathSegment.style.cssText = `
                position: absolute;
                height: 8px;
                background-color: #9b59b6;
                opacity: 0.7;
                width: ${length}px;
                left: ${x1}px;
                top: ${y1}px;
                transform: rotate(${angle}deg);
                transform-origin: 0 0;
                z-index: 3;
                pointer-events: none;
                border-radius: 4px;
            `;
            
            document.getElementById('workspace').appendChild(pathSegment);
        }
        
        this.animatePathPacketWithPath(`path-trace-${Date.now()}`, path, fromDevice, toDevice);
        
        setTimeout(() => {
            document.querySelectorAll('.path-visual').forEach(el => el.remove());
        }, window.CONFIG.PATH_ANIMATION_DURATION);
    }
    
    // Κίνηση πακέτου σε διαδρομή
    animatePathPacketWithPath(packetId, path, fromDevice, toDevice) {
        if (path.length < 2) return;
        
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-trace';
        packetEl.id = packetId;
        
        document.getElementById('workspace').appendChild(packetEl);
        
        this.animatePathSegment(packetEl, path, 0);
    }
    
    // Κίνηση πακέτου σε τμήμα διαδρομής
    animatePathSegment(packetEl, path, segmentIndex) {
        if (segmentIndex >= path.length - 1) {
            setTimeout(() => {
                if (packetEl && packetEl.parentNode) {
                    packetEl.remove();
                }
            }, 500);
            return;
        }
        
        const currentDevice = path[segmentIndex];
        const nextDevice = path[segmentIndex + 1];
        
        const startX = currentDevice.x + 60;
        const startY = currentDevice.y + 60;
        const endX = nextDevice.x + 60;
        const endY = nextDevice.y + 60;
        
        packetEl.style.left = `${startX - 9}px`;
        packetEl.style.top = `${startY - 9}px`;
        
        const startTime = Date.now();
        const duration = 800;
        
        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            
            packetEl.style.left = `${currentX - 9}px`;
            packetEl.style.top = `${currentY - 9}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => {
                    this.animatePathSegment(packetEl, path, segmentIndex + 1);
                }, 100);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Τoggle προσομοίωσης
    toggleSimulation() {
        try {
            if (this.isSimulating) {
                this.stopSimulation();
                return false;
            } else {
                this.startSimulation();
                return true;
            }
        } catch (error) {
            this.addLog(`Σφάλμα: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Έλεγχος αν IP είναι εξωτερική (Internet)
    isExternalIP(ip) {
        if (!ip || ip === 'N/A') return false;
        
        const privateRanges = [
            /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
            /^127\./, /^169\.254\./, /^203\.0\.113\./
        ];
        
        return !privateRanges.some(regex => regex.test(ip));
    }
    
    // Δοκιμή ping από συγκεκριμένη συσκευή
testPingFromDeviceWithPrompt(fromDevice, deviceManager) {
    return new Promise((resolve) => {
        const devices = deviceManager.devices;
        
        // Φίλτρο συσκευών με έγκυρη IP (εκτός από τον εαυτό του)
        const availableDevices = devices.filter(d => 
            d.id !== fromDevice.id && 
            d.ip && d.ip !== 'N/A' && d.ip !== '0.0.0.0' && d.ip !== undefined &&
            !(d.type === 'switch' && d.ip === 'N/A')
        );
        
        if (availableDevices.length === 0) {
            alert('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP για ping');
            this.addLog('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP', 'warning');
            resolve({ success: false });
            return;
        }
        
        // Δημιουργία μηνύματος prompt
        let message = `Ping από ${fromDevice.name} (${this.getIPForLog(fromDevice)})\n\n`;
        message += 'Διαθέσιμες συσκευές:\n';
        
        availableDevices.forEach((device, index) => {
            const gatewayInfo = device.gateway && device.gateway !== '0.0.0.0' ? 
                ` [GW: ${device.gateway}]` : '';
            const ipStatus = (!device.ip || device.ip === 'N/A') ? ' (Χωρίς IP)' : '';
            message += `${index + 1}. ${device.name} - ${device.ip || 'N/A'}${ipStatus}${gatewayInfo}\n`;
        });
        
        message += '\nΕισάγετε:\n';
        message += '- Αριθμό για επιλογή συσκευής (π.χ. 1)\n';
        message += '- IP διεύθυνση (π.χ. 192.168.1.1)\n';
        
        const userInput = prompt(message);
        
        if (!userInput) {
            this.addLog('Ακυρώθηκε η δοκιμή ping', 'info');
            resolve(null);
            return;
        }
        
        // Επεξεργασία εισόδου
        const input = userInput.trim();
        
        // Έλεγχος για αριθμό
        let selectedIndex = null;
        
        // ΜΟΝΟ αν το input είναι αποκλειστικά ψηφία
        if (/^\d+$/.test(input)) {
            const num = parseInt(input, 10);
            if (num >= 1 && num <= availableDevices.length) {
                selectedIndex = num - 1;
            }
        }
        
        if (selectedIndex !== null) {
            // Επιλογή συσκευής από τη λίστα
            const targetDevice = availableDevices[selectedIndex];
            this.addLog(`Επιλέχθηκε: ${targetDevice.name} (${targetDevice.ip})`, 'info');
            
            // ΒΕΒΑΙΩΣΗ: Αν ο router δεν έχει ip property, βάλε το
            if (targetDevice.type === 'router' && !targetDevice.ip) {
                targetDevice.ip = targetDevice.interfaces.lan.ip;
                targetDevice.subnetMask = targetDevice.interfaces.lan.subnetMask;
            }
            
            const result = this.testPing(fromDevice, targetDevice);
            resolve(result);
        } else {
            // Έλεγχος αν είναι IP διεύθυνση
            if (window.isValidIP && window.isValidIP(input)) {
                // Ψάξε συσκευή με αυτή την IP
                const targetDevice = deviceManager.getDeviceByIP(input);
                if (targetDevice) {
                    // ΒΕΒΑΙΩΣΗ: Αν ο router δεν έχει ip property, βάλε το IP που ζητήθηκε
                    if (targetDevice.type === 'router' && !targetDevice.ip) {
                        targetDevice.ip = input; // Το IP που ζητήθηκε (π.χ. 192.168.1.1)
                        if (input === targetDevice.interfaces.lan.ip) {
                            targetDevice.subnetMask = targetDevice.interfaces.lan.subnetMask;
                        } else if (input === targetDevice.interfaces.lan2?.ip) {
                            targetDevice.subnetMask = targetDevice.interfaces.lan2.subnetMask;
                        } else if (input === targetDevice.interfaces.wan.ip) {
                            targetDevice.subnetMask = targetDevice.interfaces.wan.subnetMask;
                        }
                    }
                    
                    const result = this.testPing(fromDevice, targetDevice);
                    resolve(result);
                } else {
                    // ΔΕΝ βρέθηκε συσκευή με αυτή την IP
                    this.addLog(`PING ${fromDevice.name} → ${input} - ΑΠΟΤΥΧΙΑ (Δεν βρέθηκε συσκευή με αυτή την IP)`, 'error');
                    
                    // Αναζήτηση διαδρομής (ακόμα και αν δεν υπάρχει συσκευή)
                    const fakeDevice = { 
                        ip: input, 
                        name: `IP ${input}`, 
                        type: 'external',
                        subnetMask: '255.255.255.0'
                    };
                    
                    const commInfo = this.connectionManager.canDevicesCommunicateWithPath(
                        fromDevice, 
                        fakeDevice
                    );
                    
                    if (commInfo.canCommunicate && commInfo.path) {
                        // Μπορεί να φτάσει (π.χ. μέσω gateway) αλλά δεν υπάρχει συσκευή
                        this.addLog(`Η συσκευή ${fromDevice.name} μπορεί να φτάσει στην IP ${input} (δεν υπάρχει συσκευή)`, 'warning');
                        this.visualizePath(commInfo.path, fromDevice, { name: `Εξωτερικό ${input}`, x: 100, y: 100 });
                        resolve({ success: true, viaGateway: commInfo.viaGateway, external: true });
                    } else {
                        // Δεν μπορεί να φτάσει
                        this.addLog(`Η συσκευή ${fromDevice.name} ΔΕΝ μπορεί να φτάσει στην IP ${input}`, 'error');
                        resolve({ success: false, external: true });
                    }
                }
            } else {
                alert(`Μη έγκυρη είσοδος: "${input}"\n\nΕισάγετε:\n1. Αριθμό από 1 έως ${availableDevices.length} (για συσκευή)\n2. Έγκυρη IP διεύθυνση (π.χ. 192.168.1.1)`);
                this.addLog(`Μη έγκυρη είσοδος: ${input}`, 'error');
                resolve({ success: false, error: 'Invalid input' });
            }
        }
    });
}    
    // Βοηθητική συνάρτηση για έλεγχο αν συσκευή έχει έγκυρη IP
    hasValidIP(device) {
        if (!device) return false;
        
        // Ειδική περίπτωση για routers - έχουν IP στα interfaces
        if (device.type === 'router') {
            const hasLanIP = device.interfaces?.lan?.ip && 
                            device.interfaces.lan.ip !== 'N/A' && 
                            device.interfaces.lan.ip !== '0.0.0.0' && 
                            device.interfaces.lan.ip !== undefined;
            const hasWanIP = device.interfaces?.wan?.ip && 
                            device.interfaces.wan.ip !== 'N/A' && 
                            device.interfaces.wan.ip !== '0.0.0.0' && 
                            device.interfaces.wan.ip !== undefined;
            return hasLanIP || hasWanIP;
        }
        
        // Άλλες συσκευές
        return device.ip && device.ip !== 'N/A' && device.ip !== '0.0.0.0' && device.ip !== undefined;
    }
    
handleRouterAsSource(router, targetDevice, isInternalCall = false) {
    // Μόνο αν ΔΕΝ είναι internal call, δείξε logs
    if (!isInternalCall) {
        console.log(`[Router Source] ${router.name} (LAN: ${router.interfaces.lan.ip}, LAN2: ${router.interfaces.lan2?.ip}) → ${targetDevice.name} (${targetDevice.ip})`);
    }
    
    // Βοηθητική για gateway που βρίσκεται στο routing table
    const findGatewayInRoutingTable = (targetIP) => {
        if (!router.routingTable || !Array.isArray(router.routingTable)) return null;
        
        for (const route of router.routingTable) {
            if (route.network && route.mask && targetIP) {
                if (areInSameNetwork(targetIP, route.network, route.mask, route.mask)) {
                    if (!isInternalCall) {
                        console.log(`[Router] Found route: ${route.network}/${route.mask} → ${route.gateway}`);
                    }
                    return route.gateway;
                }
            }
        }
        return null;
    };
    
    // 1. ΕΛΕΓΧΟΣ ΓΙΑ DIRECTLY CONNECTED NETWORKS (LAN, LAN2)
    
    // LAN Interface
    if (router.interfaces.lan && router.interfaces.lan.ip !== 'N/A') {
        if (areInSameNetwork(targetDevice.ip, router.interfaces.lan.ip,
                            router.interfaces.lan.subnetMask || '255.255.255.0',
                            targetDevice.subnetMask || '255.255.255.0')) {
            if (!isInternalCall) {
                console.log(`[Router] Target ${targetDevice.ip} is on LAN ${router.interfaces.lan.ip}`);
            }
            const path = this.connectionManager.findPathBetweenDevices(router, targetDevice);
            if (path && path.length > 0) {
                if (!isInternalCall) {
                    this.addLog(`PING ${router.name} (LAN) → ${targetDevice.name} - ΕΠΙΤΥΧΙΑ (direct)`, 'success');
                }
                // ΜΟΝΟ αν ΔΕΝ είναι internal call, δείξε πακέτο
                if (!isInternalCall) {
                    this.createPingPacket(router, targetDevice);
                }
                return { success: true, viaGateway: false, path };
            }
        }
    }
    
    // LAN2 Interface
    if (router.interfaces.lan2 && 
        router.interfaces.lan2.enabled && 
        router.interfaces.lan2.ip && 
        router.interfaces.lan2.ip !== 'N/A') {
        
        if (areInSameNetwork(targetDevice.ip, router.interfaces.lan2.ip,
                            router.interfaces.lan2.subnetMask || '255.255.255.0',
                            targetDevice.subnetMask || '255.255.255.0')) {
            if (!isInternalCall) {
                console.log(`[Router] Target ${targetDevice.ip} is on LAN2 ${router.interfaces.lan2.ip}`);
            }
            const path = this.connectionManager.findPathBetweenDevices(router, targetDevice);
            if (path && path.length > 0) {
                if (!isInternalCall) {
                    this.addLog(`PING ${router.name} (LAN2) → ${targetDevice.name} - ΕΠΙΤΥΧΙΑ (direct)`, 'success');
                }
                if (!isInternalCall) {
                    this.createPingPacket(router, targetDevice);
                }
                return { success: true, viaGateway: false, path };
            }
        }
    }
    
    // WAN Interface
    if (router.interfaces.wan && router.interfaces.wan.ip !== 'N/A') {
        if (areInSameNetwork(targetDevice.ip, router.interfaces.wan.ip,
                            router.interfaces.wan.subnetMask || '255.255.255.0',
                            targetDevice.subnetMask || '255.255.255.0')) {
            if (!isInternalCall) {
                console.log(`[Router] Target ${targetDevice.ip} is on WAN ${router.interfaces.wan.ip}`);
            }
            const path = this.connectionManager.findPathBetweenDevices(router, targetDevice);
            if (path && path.length > 0) {
                if (!isInternalCall) {
                    this.addLog(`PING ${router.name} (WAN) → ${targetDevice.name} - ΕΠΙΤΥΧΙΑ (direct)`, 'success');
                }
                if (!isInternalCall) {
                    this.createPingPacket(router, targetDevice);
                }
                return { success: true, viaGateway: false, path };
            }
        }
    }
    
    // 2. ΕΛΕΓΧΟΣ ΓΙΑ ROUTES ΜΕΣΩ ROUTING TABLE
    const routeInfo = findGatewayInRoutingTable(targetDevice.ip);
    if (routeInfo && routeInfo !== '0.0.0.0') {
        if (!isInternalCall) {
            console.log(`[Router] Using routing table gateway: ${routeInfo} for ${targetDevice.ip}`);
        }
        const gatewayDevice = window.deviceManager.getDeviceByIP(routeInfo);
        
        if (gatewayDevice) {
            const path = this.connectionManager.findPathBetweenDevices(router, gatewayDevice);
            if (path && path.length > 0) {
                if (!isInternalCall) {
                    this.addLog(`PING ${router.name} → ${targetDevice.name} - via routing table (next hop: ${routeInfo})`, 'success');
                }
                if (!isInternalCall) {
                    this.createPingPacket(router, targetDevice);
                }
                return { success: true, viaGateway: true, path, routingTable: true };
            }
        }
    }
    
    // 3. DEFAULT GATEWAY (WAN) - για εξωτερικούς προορισμούς
    if (router.interfaces.wan && 
        router.interfaces.wan.gateway && 
        router.interfaces.wan.gateway !== '0.0.0.0' && 
        router.interfaces.wan.gateway !== 'N/A') {
        
        if (!isInternalCall) {
            console.log(`[Router] Using WAN default gateway: ${router.interfaces.wan.gateway}`);
        }
        const wanGatewayDevice = window.deviceManager.getDeviceByIP(router.interfaces.wan.gateway);
        
        if (wanGatewayDevice) {
            const path = this.connectionManager.findPathBetweenDevices(router, wanGatewayDevice);
            if (path && path.length > 0) {
                const isExternal = this.isExternalIP(targetDevice.ip);
                if (isExternal) {
                    if (!isInternalCall) {
                        this.addLog(`PING ${router.name} → ${targetDevice.name} - via WAN gateway (Internet)`, 'success');
                    }
                    if (!isInternalCall) {
                        this.createPingPacket(router, targetDevice);
                    }
                    return { success: true, viaGateway: true, path, internet: true };
                }
            }
        }
    }
    
    // 4. ΕΛΕΓΧΟΣ ΓΙΑ INTER-VLAN ROUTING (LAN ↔ LAN2)
    const targetNetwork = this.connectionManager.getNetworkAddress(targetDevice.ip, targetDevice.subnetMask);
    
    if (router.interfaces.lan && router.interfaces.lan2 && router.interfaces.lan2.enabled) {
        const lanNetwork = this.connectionManager.getNetworkAddress(router.interfaces.lan.ip, router.interfaces.lan.subnetMask);
        const lan2Network = this.connectionManager.getNetworkAddress(router.interfaces.lan2.ip, router.interfaces.lan2.subnetMask);
        
        if (targetNetwork === lan2Network) {
            if (!isInternalCall) {
                console.log(`[Router] Target is on LAN2 network, routing needed from LAN`);
            }
            
            const staticRoute = router.routingTable?.find(route => 
                route.network === lan2Network && route.mask === router.interfaces.lan2.subnetMask
            );
            
            if (staticRoute) {
                if (!isInternalCall) {
                    console.log(`[Router] Found static route to LAN2: ${staticRoute.gateway}`);
                }
                const path = this.connectionManager.findPathBetweenDevices(router, targetDevice);
                if (path && path.length > 0) {
                    if (!isInternalCall) {
                        this.addLog(`PING ${router.name} → ${targetDevice.name} - via Inter-VLAN routing`, 'success');
                    }
                    if (!isInternalCall) {
                        this.createPingPacket(router, targetDevice);
                    }
                    return { success: true, viaGateway: true, path, interVLAN: true };
                }
            } else {
                if (!isInternalCall) {
                    console.log(`[Router] Auto Inter-VLAN routing between LAN and LAN2`);
                }
                const path = this.connectionManager.findPathBetweenDevices(router, targetDevice);
                if (path && path.length > 0) {
                    if (!isInternalCall) {
                        this.addLog(`PING ${router.name} → ${targetDevice.name} - via Auto Inter-VLAN routing`, 'success');
                    }
                    if (!isInternalCall) {
                        this.createPingPacket(router, targetDevice);
                    }
                    return { success: true, viaGateway: true, path, autoInterVLAN: true };
                }
            }
        }
    }
    
    if (!isInternalCall) {
        console.log(`[Router] No route found from ${router.name} to ${targetDevice.name}`);
        this.addLog(`PING ${router.name} (${router.interfaces.lan.ip}) → ${targetDevice.name} (${targetDevice.ip}) - ΑΠΟΤΥΧΙΑ (δεν βρέθηκε διαδρομή)`, 'error');
    }
    return { success: false, noRoute: true };
}

// Modified portion: testPing (only the full function is shown for clarity)

testPing(fromDevice, toDevice) {
    console.log(`[PING] Έλεγχος: ${fromDevice.name} → ${toDevice.name}`);

    // Βεβαιώσου ότι ο προορισμός έχει IP
    if (toDevice.type === 'router' && !toDevice.ip) {
        toDevice.ip = toDevice.interfaces.lan.ip;
        toDevice.subnetMask = toDevice.interfaces.lan.subnetMask;
    }
    
    const fromIP = fromDevice.ip || 'N/A';
    const toIP = toDevice.ip || 'N/A';
    
    console.log(`[PING] From IP: ${fromIP}, To IP: ${toIP}`);
    
    // ΑΜΕΣΗ ΑΠΟΡΡΙΨΗ: Αν ο προορισμός δεν έχει IP
    if (!toIP || toIP === 'N/A') {
        this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) ΑΠΕΤΥΧΕ: Ο προορισμός δεν έχει έγκυρη IP διεύθυνση`, 'error');
        return { success: false, noIP: true };
    }
    
    // ΕΙΔΙΚΗ ΠΕΡΙΠΤΩΣΗ: Router ως source
    if (fromDevice.type === 'router') {
        console.log(`[PING] Router ως source`);
        const routerResult = this.handleRouterAsSource(fromDevice, toDevice, false);
        if (routerResult !== null && routerResult.success !== false) {
            return routerResult;
        }
    }

    // 1. ΕΛΕΓΧΟΣ ΓΙΑ ΙΔΙΟ ΔΙΚΤΥΟ
    console.log(`[PING] Έλεγχος αν είναι στο ίδιο δίκτυο...`);
    
    const ip1 = fromDevice.ip;
    const mask1 = fromDevice.subnetMask || '255.255.255.0';
    const ip2 = toDevice.ip;
    const mask2 = toDevice.subnetMask || '255.255.255.0';
    
    console.log(`[PING] Network check: ${ip1}/${mask1} vs ${ip2}/${mask2}`);
    
    const isLocal = areInSameNetwork(ip1, ip2, mask1, mask2);
    console.log(`[PING] Same network? ${isLocal}`);
    
    if (isLocal) {
        console.log(`[PING] Ίδιο δίκτυο - άμεση επικοινωνία`);
        
        const communication = this.connectionManager.canDevicesCommunicateDirectly(fromDevice, toDevice);
        console.log(`[PING] Communication result:`, communication);
        
        if (communication.canCommunicate) {
            this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΕΠΙΤΥΧΙΑ (ίδιο δίκτυο)`, 'success');
            
            // ΑΛΛΑΓΗ 1: ΧΩΡΙΣ path παράμετρο για απλό ping
            this.createPingPacket(fromDevice, toDevice);
            return { success: true, viaGateway: false };
        } else {
            this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (δεν υπάρχει φυσική σύνδεση)`, 'error');
            return { success: false };
        }
    }
    
    // 2. ΔΙΑΦΟΡΕΤΙΚΟ ΔΙΚΤΥΟ - ΧΡΕΙΑΖΕΤΑΙ GATEWAY
    console.log(`[PING] Διαφορετικό δίκτυο, αναζήτηση gateway`);
    
    const gatewayIP = fromDevice.gateway;
    console.log(`[PING] Gateway IP: ${gatewayIP}`);
    
    if (!gatewayIP || gatewayIP === '0.0.0.0' || gatewayIP === 'N/A') {
        this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) ΑΠΕΤΥΧΕ: διαφορετικό subnet & δεν υπάρχει gateway`, 'error');
        return { success: false };
    }
    
    const gatewayDevice = window.deviceManager.getDeviceByIP(gatewayIP);
    console.log(`[PING] Gateway device:`, gatewayDevice?.name);
    
    if (!gatewayDevice) {
        this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (gateway συσκευή δεν βρέθηκε)`, 'error');
        return { success: false };
    }
    
    if (gatewayDevice.type === 'router') {
        console.log(`[PING] Gateway είναι router, καλώ handleRouterAsSource`);
        
        // ΑΛΛΑΓΗ 2: true για internal call (όχι logs/packet από τον router)
        const routerResult = this.handleRouterAsSource(gatewayDevice, toDevice, true);
        console.log(`[PING] Router result:`, routerResult);
        
        if (routerResult && routerResult.success) {
            const pathToGateway = this.connectionManager.findPathBetweenDevices(fromDevice, gatewayDevice);
            
            if (pathToGateway && pathToGateway.length > 0) {
                this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) ΜΕΣΩ GATEWAY (${gatewayDevice.name}) - ΕΠΙΤΥΧΙΑ`, 'success');
                // ΑΛΛΑΓΗ 3: Ping μόνο μέχρι gateway (όχι μέχρι τον προορισμό)
                this.createPingPacket(fromDevice, toDevice);
                return { success: true, viaGateway: true };
            }
        }
        
        this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (το gateway δεν μπορεί να φτάσει τον προορισμό)`, 'error');
        return { success: false, viaGateway: true };
    }
    
    this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (gateway δεν είναι router)`, 'error');
    return { success: false };
}
    // Βοηθητική συνάρτηση για IP στο log
getIPForLog(device) {
    if (!device) return 'N/A';
    
    if (device.type === 'router') {
        // Ελέγχουμε ποιο interface χρησιμοποιείται για κάθε σύνδεση
        if (device.connectionInterfaces && Object.keys(device.connectionInterfaces).length > 0) {
            const connIds = Object.keys(device.connectionInterfaces);
            console.log(`[GET IP FOR LOG] Router ${device.name} έχει ${connIds.length} συνδέσεις`);
            
            for (const connId of connIds) {
                const iface = device.connectionInterfaces[connId];
                console.log(`[GET IP FOR LOG] Σύνδεση ${connId} -> Interface: ${iface}`);
                
                if (iface === 'lan2' && device.interfaces.lan2 && device.interfaces.lan2.enabled) {
                    console.log(`[GET IP FOR LOG] Επιστροφή LAN2 IP: ${device.interfaces.lan2.ip}`);
                    return device.interfaces.lan2.ip;
                }
            }
        }
        
        // Αλλιώς επιστροφή LAN IP (default)
        console.log(`[GET IP FOR LOG] Router ${device.name} -> Επιστροφή LAN IP: ${device.interfaces.lan.ip}`);
        return device.interfaces.lan.ip || 'N/A';
    }
    
    // Για άλλες συσκευές
    return device.ip || 'N/A';
}

    // Δοκιμή ping μεταξύ τυχαίων συσκευών
    testPingBetweenDevices(deviceManager) {
        const devices = deviceManager.devices;
        if (devices.length < 2) {
            throw new Error('Πρέπει να υπάρχουν τουλάχιστον 2 συσκευές για δοκιμή ping');
        }
        
        // Φιλτράρουμε συσκευές με έγκυρη IP
        const devicesWithIP = devices.filter(d => this.hasValidIP(d));
        if (devicesWithIP.length < 2) {
            throw new Error('Πρέπει να υπάρχουν τουλάχιστον 2 συσκευές με έγκυρη IP για δοκιμή ping');
        }
        
        const device1 = devicesWithIP[Math.floor(Math.random() * devicesWithIP.length)];
        let device2;
        do {
            device2 = devicesWithIP[Math.floor(Math.random() * devicesWithIP.length)];
        } while (device2.id === device1.id);
        
        return this.testPing(device1, device2);
    }
    
    // Δοκιμή επικοινωνίας μεταξύ δύο συσκευών
testCommunicationBetween(device1, device2) {
    console.log(`[ΔΟΚΙΜΗ] ${device1.name} → ${device2.name}`);
    
    // Χρησιμοποιούμε την ΑΚΡΙΒΗ ίδια λογική με το ping
    const ip1 = device1.ip;
    const mask1 = device1.subnetMask || '255.255.255.0';
    
    let ip2 = device2.ip;
    let mask2 = device2.subnetMask || '255.255.255.0';
    
    // ΚΑΤΑΛΑΜΒΑΝΟΥΜΕ: Αυτό το κομμάτι που λείπει!
    // Για router προορισμό, βρες το σωστό interface IP
    if (device2.type === 'router' && device2.ip) {
        console.log(`[ΔΟΚΙΜΗ] Προορισμός είναι router, IP: ${device2.ip}`);
        
        // Ελέγχουμε αν το ζητούμενο IP είναι LAN2 του router
        if (device2.interfaces.lan2 && 
            device2.interfaces.lan2.enabled && 
            device2.interfaces.lan2.ip &&
            device2.interfaces.lan2.ip === device2.ip) {
            
            console.log(`[ΔΟΚΙΜΗ] Το ${device2.ip} είναι LAN2 του router`);
            ip2 = device2.interfaces.lan2.ip;
            mask2 = device2.interfaces.lan2.subnetMask;
        }
        // Ελέγχουμε αν το ζητούμενο IP είναι LAN του router
        else if (device2.interfaces.lan && 
                 device2.interfaces.lan.ip &&
                 device2.interfaces.lan.ip === device2.ip) {
            
            console.log(`[ΔΟΚΙΜΗ] Το ${device2.ip} είναι LAN του router`);
            ip2 = device2.interfaces.lan.ip;
            mask2 = device2.interfaces.lan.subnetMask;
        }
    }
    
    console.log(`[ΔΟΚΙΜΗ] Network check: ${ip1}/${mask1} vs ${ip2}/${mask2}`);
    
    const isLocal = areInSameNetwork(ip1, ip2, mask1, mask2);
    console.log(`[ΔΟΚΙΜΗ] Same network? ${isLocal}`);
    
    let finalPath = null;
    let viaGateway = false;

    if (isLocal) {
        // ΑΜΕΣΗ ΕΠΙΚΟΙΝΩΝΙΑ (ίδιο δίκτυο)
        console.log(`[ΔΟΚΙΜΗ] Ίδιο δίκτυο - άμεση επικοινωνία`);
        finalPath = this.connectionManager.findPathBetweenDevices(device1, device2);
        viaGateway = false;
        
        console.log(`[ΔΟΚΙΜΗ] Path found:`, finalPath ? finalPath.map(d => d.name).join(' → ') : 'none');
    } else {
        // ΔΙΑΦΟΡΕΤΙΚΟ ΔΙΚΤΥΟ
        console.log(`[ΔΟΚΙΜΗ] Διαφορετικό δίκτυο, ψάχνω gateway`);
        
        const fromGatewayIP = this.connectionManager.getDeviceGateway(device1);
        console.log(`[ΔΟΚΙΜΗ] Gateway IP: ${fromGatewayIP}`);
        
        if (fromGatewayIP && fromGatewayIP !== '0.0.0.0' && fromGatewayIP !== 'N/A') {
            const gatewayDevice = window.deviceManager.getDeviceByIP(fromGatewayIP);
            console.log(`[ΔΟΚΙΜΗ] Gateway device:`, gatewayDevice?.name);

            if (gatewayDevice && gatewayDevice.type === 'router') {
                // Route: source → router
                const pathToGateway = this.connectionManager.findPathBetweenDevices(device1, gatewayDevice);
                // Route: router → target
                const pathFromGateway = this.connectionManager.findPathBetweenDevices(gatewayDevice, device2);
                
                console.log(`[ΔΟΚΙΜΗ] Path to gateway:`, pathToGateway?.map(d => d.name).join(' → '));
                console.log(`[ΔΟΚΙΜΗ] Path from gateway:`, pathFromGateway?.map(d => d.name).join(' → '));

                if (pathToGateway && pathFromGateway && 
                    pathToGateway.length > 0 && pathFromGateway.length > 0) {
                    
                    if (pathToGateway[pathToGateway.length - 1].id === pathFromGateway[0].id) {
                        finalPath = [...pathToGateway, ...pathFromGateway.slice(1)];
                    } else {
                        finalPath = [...pathToGateway, ...pathFromGateway];
                    }
                    viaGateway = true;
                    
                    console.log(`[ΔΟΚΙΜΗ] Full path via gateway:`, finalPath.map(d => d.name).join(' → '));
                }
            }
        }
    }

    // Εμφάνιση αποτελέσματος
    if (finalPath && finalPath.length > 0) {
        const viaText = viaGateway ? 'ΜΕΣΩ ROUTER' : 'ΑΜΕΣΑ';
        this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΕΠΙΤΥΧΙΑ ${viaText}`, 'success');
        this.addLog(`Διαδρομή: ${finalPath.map(d => d.name).join(' → ')}`, 'info');
        this.visualizePath(finalPath, device1, device2);
        return { success: true, viaGateway, path: finalPath };
    } else {
        this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΑΠΟΤΥΧΙΑ (αδύνατη επικοινωνία)`, 'error');
        return { success: false };
    }
}
    // Βοηθητική συνάρτηση για logging
    addLog(message, type = 'info') {
        if (typeof window.addLog === 'function') {
            window.addLog(message, type);
        } else {
            console.log(`[ΠΡΟΣΟΜΟΙΩΣΗ ${type.toUpperCase()}] ${message}`);
        }
    }
}

// Εξαγωγή της κλάσης
export default SimulationManager;
