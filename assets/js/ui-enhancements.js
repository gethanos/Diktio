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
// UI Enhancements - Νέο αρχείο για προχωρημένες UI λειτουργίες
class UIEnhancements {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.loadingStates = new Map();
        this.tutorialSteps = [];
        this.currentTutorialStep = 0;
    }
    
    // Initialize enhanced UI features
    initialize() {
        this.setupTutorial();
        this.setupKeyboardShortcuts();
        this.setupContextMenus();
        this.setupAutoSave();
        this.setupHelpSystem();
    }
    
    // Setup interactive tutorial
    setupTutorial() {
        this.tutorialSteps = [
            {
                title: "Καλώς ήρθατε! 👋",
                content: "Αυτός είναι ο Προσομοιωτής Δικτύων. Εδώ μπορείτε να δημιουργήσετε και να δοκιμάσετε διάφορα δίκτυα.",
                target: null,
                position: "center"
            },
            {
                title: "Προσθέστε συσκευές",
                content: "Κάντε κλικ σε οποιαδήποτε συσκευή από τη βιβλιοθήκη για να την προσθέσετε στο workspace.",
                target: ".device-list",
                position: "right"
            },
            {
                title: "Συνδέστε συσκευές",
                content: "Πατήστε 'Σύνδεση Συσκευών' και μετά κλικ σε δύο συσκευές για να τις συνδέσετε.",
                target: "#connectBtn",
                position: "bottom"
            },
            {
                title: "Ρυθμίσεις συσκευής",
                content: "Κάντε κλικ σε μια συσκευή για να δείτε και να αλλάξετε τις ρυθμίσεις της.",
                target: ".workspace",
                position: "center"
            }
        ];
    }
    
    // Start tutorial
    startTutorial() {
        this.currentTutorialStep = 0;
        this.showTutorialStep();
    }
    
    // Show current tutorial step
    showTutorialStep() {
        if (this.currentTutorialStep >= this.tutorialSteps.length) {
            this.hideTutorial();
            return;
        }
        
        const step = this.tutorialSteps[this.currentTutorialStep];
        this.showTutorialOverlay(step);
    }
    
    // Show tutorial overlay
    showTutorialOverlay(step) {
        // Remove existing tutorial overlay
        const existingOverlay = document.getElementById('tutorialOverlay');
        if (existingOverlay) existingOverlay.remove();
        
        // Create new overlay
        const overlay = document.createElement('div');
        overlay.id = 'tutorialOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Create tutorial box
        const tutorialBox = document.createElement('div');
        tutorialBox.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 30px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.4s ease;
        `;
        
        tutorialBox.innerHTML = `
            <h3 style="margin-top: 0; color: #2c3e50; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-graduation-cap"></i>
                ${step.title}
            </h3>
            <p style="color: #34495e; line-height: 1.6; font-size: 1.1rem;">
                ${step.content}
            </p>
            <div style="display: flex; justify-content: space-between; margin-top: 25px;">
                <button id="tutorialPrev" class="button" style="background: #95a5a6;">
                    <i class="fas fa-arrow-left"></i> Προηγούμενο
                </button>
                <div>
                    <span style="color: #7f8c8d; margin-right: 15px;">
                        ${this.currentTutorialStep + 1} / ${this.tutorialSteps.length}
                    </span>
                    ${this.currentTutorialStep === this.tutorialSteps.length - 1 ? 
                      `<button id="tutorialFinish" class="button" style="background: #2ecc71;">
                          Τέλος <i class="fas fa-check"></i>
                       </button>` :
                      `<button id="tutorialNext" class="button" style="background: #3498db;">
                          Επόμενο <i class="fas fa-arrow-right"></i>
                       </button>`
                    }
                </div>
            </div>
        `;
        
        overlay.appendChild(tutorialBox);
        document.body.appendChild(overlay);
        
        // Add event listeners
        document.getElementById('tutorialNext')?.addEventListener('click', () => {
            this.currentTutorialStep++;
            this.showTutorialStep();
        });
        
        document.getElementById('tutorialPrev')?.addEventListener('click', () => {
            this.currentTutorialStep--;
            this.showTutorialStep();
        });
        
        document.getElementById('tutorialFinish')?.addEventListener('click', () => {
            this.hideTutorial();
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideTutorial();
            }
        });
    }
    
    // Hide tutorial
    hideTutorial() {
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) overlay.remove();
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'a': // Add device
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const type = prompt("Εισάγετε τύπο συσκευής (router, switch, computer, server, cloud, dns, printer):");
                        if (type && window.CONFIG.DEVICE_TYPES[type]) {
                            window.addDevice(type);
                        }
                    }
                    break;
                    
                case 'c': // Clear workspace
                    if (e.ctrlKey) {
                        e.preventDefault();
                        if (confirm("Θέλετε να καθαρίσετε όλο το workspace;")) {
                            window.clearWorkspace?.();
                        }
                    }
                    break;
                    
                case 's': // Start/stop simulation
                    if (e.ctrlKey) {
                        e.preventDefault();
                        window.toggleSimulation?.();
                    }
                    break;
                    
                case 'd': // Debug info
                    if (e.ctrlKey) {
                        e.preventDefault();
                        window.debugInfo?.();
                    }
                    break;
                    
                case 'f1': // Help
                    e.preventDefault();
                    this.showHelp();
                    break;
                    
                case 'escape': // Cancel modes
                    if (window.uiManager) {
                        if (window.uiManager.connectionMode) window.uiManager.toggleConnectionMode();
                        if (window.uiManager.testMode) window.uiManager.toggleTestMode();
                        if (window.uiManager.manualDNSMode) window.uiManager.toggleManualDNSMode();
                    }
                    break;
            }
        });
    }
    
    // Setup context menus for devices
    setupContextMenus() {
        // This would be called when devices are created
        // to add right-click context menus
    }
    
    // Setup auto-save functionality
    setupAutoSave() {
        let saveTimeout;
        
        const saveNetwork = () => {
            if (window.deviceManager && window.connectionManager) {
                const networkState = {
                    devices: window.deviceManager.devices.map(d => ({
                        type: d.type,
                        name: d.name,
                        x: d.x,
                        y: d.y,
                        ip: d.ip,
                        gateway: d.gateway,
                        dns: d.dns
                    })),
                    connections: window.connectionManager.connections.map(c => ({
                        device1Id: c.device1Id,
                        device2Id: c.device2Id
                    })),
                    timestamp: new Date().toISOString()
                };
                
                try {
                    localStorage.setItem('networkSimulatorState', JSON.stringify(networkState));
                } catch (e) {
                    console.warn('Αποθήκευση απέτυχε:', e);
                }
            }
        };
        
        // Auto-save every 30 seconds
        setInterval(saveNetwork, 30000);
        
        // Also save on page unload
        window.addEventListener('beforeunload', saveNetwork);
        
        // Load saved state if exists
        this.loadSavedState();
    }
    
    // Load saved network state
    loadSavedState() {
        try {
            const saved = localStorage.getItem('networkSimulatorState');
            if (saved) {
                const state = JSON.parse(saved);
                const shouldLoad = confirm('Βρέθηκε αποθηκευμένο δίκτυο. Θέλετε να το φορτώσετε;');
                
                if (shouldLoad) {
                    // Implementation would go here
                    // This is a placeholder for actual loading logic
                    window.showNotification?.('Φορτώθηκε αποθηκευμένο δίκτυο', 'success');
                }
            }
        } catch (e) {
            console.warn('Φόρτωση αποθηκευμένου απέτυχε:', e);
        }
    }
    
    // Setup help system
    setupHelpSystem() {
        // Add help button to header
        const header = document.querySelector('header > div');
        if (header) {
            const helpBtn = document.createElement('button');
            helpBtn.className = 'button';
            helpBtn.style.cssText = 'background: #9b59b6; margin-left: 10px;';
            helpBtn.innerHTML = '<i class="fas fa-question-circle"></i> Βοήθεια';
            helpBtn.onclick = () => this.showHelp();
            header.appendChild(helpBtn);
        }
    }
    
    // Show help modal
    showHelp() {
        const overlay = document.createElement('div');
        overlay.id = 'helpOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const helpContent = document.createElement('div');
        helpContent.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            animation: slideUp 0.4s ease;
        `;
        
        helpContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h2 style="margin: 0; color: #2c3e50; display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-question-circle"></i>
                    Βοήθεια Προσομοιωτή Δικτύων
                </h2>
                <button id="closeHelp" style="background: none; border: none; font-size: 24px; color: #95a5a6; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px;">
                <div>
                    <h3 style="color: #3498db; margin-top: 0;">
                        <i class="fas fa-mouse-pointer"></i> Βασικές Λειτουργίες
                    </h3>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li><strong>Προσθήκη συσκευής:</strong> Κλικ στη βιβλιοθήκη ή Ctrl+A</li>
                        <li><strong>Μετακίνηση συσκευής:</strong> Σύρετε με το ποντίκι</li>
                        <li><strong>Σύνδεση συσκευών:</strong> Κουμπί "Σύνδεση" ή κλικ σε 2 συσκευές</li>
                        <li><strong>Ρυθμίσεις συσκευής:</strong> Κλικ στη συσκευή → καρτέλα πληροφοριών</li>
                        <li><strong>Διαγραφή:</strong> Καρτέλα πληροφοριών → Αφαίρεση Συσκευής</li>
                    </ul>
                </div>
                
                <div>
                    <h3 style="color: #2ecc71; margin-top: 0;">
                        <i class="fas fa-keyboard"></i> Συντομεύσεις Πληκτρολογίου
                    </h3>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li><strong>Ctrl+A:</strong> Προσθήκη νέας συσκευής</li>
                        <li><strong>Ctrl+C:</strong> Καθαρισμός workspace</li>
                        <strong>Ctrl+S:</strong> Εναλλαγή προσομοίωσης</li>
                        <li><strong>Ctrl+D:</strong> Πληροφορίες debug</li>
                        <li><strong>F1:</strong> Αυτή η βοήθεια</li>
                        <li><strong>Escape:</strong> Ακύρωση τρέχουσας λειτουργίας</li>
                    </ul>
                </div>
                
                <div>
                    <h3 style="color: #9b59b6; margin-top: 0;">
                        <i class="fas fa-vial"></i> Εργαλεία Δοκιμών
                    </h3>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li><strong>Ping:</strong> Δοκιμή επικοινωνίας μεταξύ συσκευών</li>
                        <li><strong>Routing:</strong> Εύρεση διαδρομής μεταξύ συσκευών</li>
                        <li><strong>DNS:</strong> Αυτόματη επίλυση ονομάτων</li>
                        <li><strong>Χειροκίνητο DNS:</strong> Επιλογή DNS server</li>
                        <li><strong>Προσομοίωση:</strong> Τυχαία κυκλοφορία δικτύου</li>
                    </ul>
                </div>
                
                <div>
                    <h3 style="color: #ff9800; margin-top: 0;">
                        <i class="fas fa-lightbulb"></i> Συμβουλές
                    </h3>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li>Χρησιμοποιήστε τα "Προκαθορισμένα Δίκτυα" για γρήγορη έναρξη</li>
                        <li>Ρυθμίστε πρώτα το DNS server πριν από DNS queries</li>
                        <li>Χρησιμοποιήστε "Αυτόματο Routing" για αυτόματη ρύθμιση gateways</li>
                        <li>Το δίκτυο σας αποθηκεύεται αυτόματα κάθε 30 δευτερόλεπτα</li>
                        <li>Μπορείτε να κάνετε drag & drop συσκευές για καλύτερη οργάνωση</li>
                    </ul>
                </div>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                <button class="button" onclick="uiEnhancements?.startTutorial?.()" 
                        style="background: #3498db; margin-right: 10px;">
                    <i class="fas fa-graduation-cap"></i> Έναρξη Οδηγιών
                </button>
                <button id="resetTutorial" class="button" style="background: #95a5a6;">
                    <i class="fas fa-redo"></i> Επαναφορά Όλων
                </button>
            </div>
        `;
        
        overlay.appendChild(helpContent);
        document.body.appendChild(overlay);
        
        // Close button
        document.getElementById('closeHelp').onclick = () => overlay.remove();
        
        // Reset tutorial button
        document.getElementById('resetTutorial').onclick = () => {
            localStorage.removeItem('tutorialCompleted');
            overlay.remove();
            window.showNotification?.('Επαναφέρθηκαν οι οδηγίες', 'success');
        };
        
        // Close on escape
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') overlay.remove();
        };
        document.addEventListener('keydown', closeOnEscape);
        
        // Remove listener when overlay is removed
        overlay.addEventListener('remove', () => {
            document.removeEventListener('keydown', closeOnEscape);
        });
    }
    
    // Set loading state for a button
    setLoading(buttonId, loading, text = null) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (loading) {
            this.loadingStates.set(buttonId, {
                originalHTML: button.innerHTML,
                originalText: button.textContent
            });
            
            button.disabled = true;
            button.innerHTML = `<span class="loading"></span> ${text || 'Φόρτωση...'}`;
        } else {
            const state = this.loadingStates.get(buttonId);
            if (state) {
                button.innerHTML = state.originalHTML;
                button.disabled = false;
                this.loadingStates.delete(buttonId);
            }
        }
    }
    
    // Update global status
    updateGlobalStatus(status, text) {
        const statusDot = document.getElementById('globalStatus');
        const statusText = document.getElementById('statusText');
        
        if (statusDot && statusText) {
            statusDot.className = 'connection-status-dot ' + status;
            statusText.textContent = text;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for simulator to be ready
    setTimeout(() => {
        if (window.uiManager) {
            window.uiEnhancements = new UIEnhancements(window.uiManager);
            window.uiEnhancements.initialize();
            
            // Add tutorial button
            const tutorialBtn = document.createElement('button');
            tutorialBtn.className = 'button';
            tutorialBtn.style.cssText = 'background: #00bcd4; margin-left: 10px;';
            tutorialBtn.innerHTML = '<i class="fas fa-graduation-cap"></i> Οδηγίες';
            tutorialBtn.onclick = () => window.uiEnhancements.startTutorial();
            
            const headerDiv = document.querySelector('header > div');
            if (headerDiv) {
                headerDiv.appendChild(tutorialBtn);
            }
        }
    }, 1000);
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(style);
