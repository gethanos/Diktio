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
import { isValidIP } from './network-core.js';
import { getL3Interfaces } from './routing.js';

// Διαχείριση προσομοίωσης - ΔΙΟΡΘΩΜΕΝΗ ΈΚΔΟΣΗ με INTERNET ACCESS και FIXED PING

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
    

    
    // Επιλογή προορισμού με prompt και ping (ή δοκιμή υπηρεσίας, π.χ. { protocol: 'tcp', port: 80 }).
    // Στη λίστα μπαίνουν όλες οι συσκευές με IP, και οι routers/firewalls. Δεκτή είναι και IP διεύθυνση.
    testPingFromDeviceWithPrompt(fromDevice, deviceManager, service = null) {
        const action = service ? `Δοκιμή ${this.describeService(service)}` : 'Ping';
        const candidates = deviceManager.devices.filter(d => d.id !== fromDevice.id && getL3Interfaces(d).length > 0);

        if (candidates.length === 0) {
            alert('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP');
            this.addLog('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP', 'warning');
            return { success: false };
        }

        const list = candidates.map((device, index) => {
            const addresses = getL3Interfaces(device).map(iface => iface.ip).join(', ');
            const gateway = device.gateway && device.gateway !== '0.0.0.0' ? ` [GW: ${device.gateway}]` : '';
            return `${index + 1}. ${device.name} - ${addresses}${gateway}`;
        }).join('\n');

        const input = prompt(
            `${action} από ${fromDevice.name} (${this.getIPForLog(fromDevice)})\n\n` +
            `Διαθέσιμες συσκευές:\n${list}\n\n` +
            `Εισάγετε αριθμό συσκευής (π.χ. 1) ή IP διεύθυνση (π.χ. 192.168.1.1):`
        )?.trim();

        if (!input) {
            this.addLog(`Ακυρώθηκε: ${action}`, 'info');
            return null;
        }

        if (/^\d+$/.test(input) && Number(input) >= 1 && Number(input) <= candidates.length) {
            return this.testPing(fromDevice, candidates[Number(input) - 1], { ...service });
        }

        if (isValidIP(input)) {
            // Μόνο συσκευή με ενεργή διεπαφή L3 σε αυτή την IP (όχι π.χ. IP με άκυρη μάσκα)
            const target = candidates.find(d => getL3Interfaces(d).some(iface => iface.ip === input));
            if (target) return this.testPing(fromDevice, target, { ...service, targetIP: input });
            this.addLog(`${action} ${fromDevice.name} → ${input} - ΑΠΟΤΥΧΙΑ: καμία συσκευή δεν έχει αυτή την IP, δεν υπάρχει απάντηση`, 'error');
            return { success: false };
        }

        alert(`Μη έγκυρη είσοδος: "${input}"\n\nΕισάγετε αριθμό από 1 έως ${candidates.length} ή έγκυρη IP διεύθυνση.`);
        this.addLog(`Μη έγκυρη είσοδος: ${input}`, 'error');
        return { success: false, error: 'Invalid input' };
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
    

    
    // Όπως πριν: το αποτέλεσμα ενός ping ανοίγει το console αν είναι κλειστό
    showConsole() {
        const consoleElement = document.getElementById('console');
        if (typeof window.toggleConsole === 'function' && consoleElement?.style.display === 'none') {
            window.toggleConsole();
        }
    }

    // options: { targetIP, protocol, port }. Χωρίς protocol είναι ICMP ping.
    testPing(fromDevice, toDevice, options = {}) {
        this.showConsole();
        const result = this.connectionManager.canDevicesCommunicateWithPath(fromDevice, toDevice, options);
        const action = options.protocol && options.protocol !== 'icmp' ? this.describeService(options) : 'PING';
        const label = `${action} ${fromDevice.name} (${result.sourceIP ?? this.getIPForLog(fromDevice)}) → ` +
                      `${toDevice.name} (${result.targetIP ?? this.getIPForLog(toDevice)})`;

        if (!result.canCommunicate) {
            this.addLog(`${label} - ΑΠΟΤΥΧΙΑ: ${this.describePingFailure(result)}`, 'error');
            return { success: false, reason: result.reason };
        }

        this.addLog(`${label} - ΕΠΙΤΥΧΙΑ${result.viaGateway ? ' ΜΕΣΩ GATEWAY' : ''}`, 'success');
        this.addLog(`Διαδρομή: ${result.path.map(d => d.name).join(' → ')}`, 'info');
        this.createPingPacket(fromDevice, toDevice, result.path);
        return { success: true, viaGateway: result.viaGateway, path: result.path };
    }
    
    // Για router χωρίς ρητή διεπαφή: η πρώτη ενεργή διεπαφή με IP
    getIPForLog(device) {
        if (!device) return 'N/A';
        if (device.type !== 'router') return device.ip || 'N/A';
        const iface = ['lan', 'lan2', 'wan']
            .map(name => device.interfaces?.[name])
            .find(i => i && i.enabled !== false && i.ip && i.ip !== 'N/A');
        return iface?.ip ?? 'N/A';
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
    
    // Ίδια απόφαση με το ping, με οπτικοποίηση της διαδρομής
    testCommunicationBetween(device1, device2) {
        const result = this.connectionManager.canDevicesCommunicateWithPath(device1, device2);

        if (!result.canCommunicate) {
            this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΑΠΟΤΥΧΙΑ: ${this.describePingFailure(result)}`, 'error');
            return { success: false, reason: result.reason };
        }

        this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΕΠΙΤΥΧΙΑ ${result.viaGateway ? 'ΜΕΣΩ ROUTER' : 'ΑΜΕΣΑ'}`, 'success');
        this.addLog(`Διαδρομή: ${result.path.map(d => d.name).join(' → ')}`, 'info');
        this.visualizePath(result.path, device1, device2);
        return { success: true, viaGateway: result.viaGateway, path: result.path };
    }
    
    // Το console ανοίγει μόνο σε σφάλμα (ο UIManager το κάνει ήδη στο showConsoleIfError)
    addLog(message, type = 'info') {
        if (typeof window.addLog === 'function') {
            window.addLog(message, type);
        } else {
            console.log(`[ΠΡΟΣΟΜΟΙΩΣΗ ${type.toUpperCase()}] ${message}`);
        }
    }

    // Μηνύματα αποτυχίας ανά αιτία (routing.js). Το πρόθεμα reply- σημαίνει ότι
    // έφτασε το αίτημα αλλά όχι η απάντηση.
    describePingFailure(result) {
        const reasons = {
            'no-source-ip': 'η πηγή δεν έχει έγκυρη IP',
            'no-target-ip': 'ο προορισμός δεν έχει έγκυρη IP',
            'no-ip': 'μία από τις συσκευές δεν έχει έγκυρη IP',
            'no-route': 'δεν υπάρχει διαδρομή (ούτε on-link ούτε gateway/route)',
            'arp-failed': 'το επόμενο βήμα δεν απαντά σε ARP στο ίδιο δίκτυο (καλώδιο, μάσκα ή gateway)',
            'ip-conflict': 'διπλότυπη IP στο ίδιο δίκτυο',
            'not-a-router': 'το gateway δεν είναι router',
            'ttl-expired': 'βρόχος δρομολόγησης (TTL expired)',
            'firewall-blocked': `μπλοκαρίστηκε από firewall (${result.detail})`,
            'other-host': `την ίδια IP έχει άλλη συσκευή, ${result.detail}, που έλαβε το πακέτο`
        };
        const isReply = result.reason?.startsWith('reply-');
        const reason = reasons[isReply ? result.reason.slice('reply-'.length) : result.reason] ?? result.reason;
        const where = result.failedAt ? ` στο ${result.failedAt.name}` : '';
        return isReply ? `δεν επιστρέφει απάντηση: ${reason}${where}` : `${reason}${where}`;
    }

    describeService({ protocol = 'icmp', port = null } = {}) {
        return protocol === 'icmp' ? 'ICMP (ping)' : `${protocol.toUpperCase()}${port ? `/${port}` : ''}`;
    }
}

// Εξαγωγή της κλάσης
export default SimulationManager;
