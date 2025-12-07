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
// help.js - Εγχειρίδιο Βοήθειας για τον Προσομοιωτή Δικτύων

/**
 * Εμφανίζει το πλήρες εγχειρίδιο βοήθειας στην κονσόλα
 */
function showHelp() {
    // Show console first (maximized)
    const consoleElement = document.getElementById('console');
    const consoleBody = document.getElementById('consoleBody');
    
    if (!consoleElement || !consoleBody) {
        console.error('Console elements not found');
        return;
    }
    
    // Maximize console for help view
    consoleElement.style.display = 'flex';
    consoleElement.style.height = '80vh';
    consoleElement.style.zIndex = '2000';
    consoleElement.classList.add('console-fullscreen');
    
    // ΔΗΜΙΟΥΡΓΟΥΜΕ ΚΑΝΟΝΙΚΟ HTML, ΟΧΙ ΜΕ addToConsole()
    consoleBody.innerHTML = `
        <div class="help-header">
            <div class="help-title">📘 ΕΓΧΕΙΡΙΔΙΟ ΒΟΗΘΕΙΑΣ - ΠΡΟΣΟΜΟΙΩΤΗΣ ΔΙΚΤΥΩΝ</div>
            <div class="help-separator">════════════════════════════════════════════════════════════════════════════════</div>
        </div>
        <div class="help-content" id="helpContent">
            <div style="padding: 20px; text-align: center; color: #ccc;">
                <i class="fas fa-spinner fa-spin"></i> Φόρτωση εγχειριδίου...
            </div>
        </div>
        <div class="help-footer">
            <div class="help-separator">════════════════════════════════════════════════════════════════════════════════</div>
            <div class="help-navigation">
                <span style="color: #f39c12;">🎯 ΠΕΡΙΗΓΗΣΗ:</span>
                [ESC]: Έξοδος • [HOME]: Αρχή • [END]: Τέλος • [PgUp/PgDn]: Σελίδα
            </div>
        </div>
    `;
    
    // Load help text from file
    fetch('help.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('Δεν βρέθηκε το αρχείο βοήθειας');
            }
            return response.text();
        })
        .then(helpText => {
            const helpContent = document.getElementById('helpContent');
            if (!helpContent) return;
            
            // Format the help text
            const formattedText = formatHelpText(helpText);
            helpContent.innerHTML = formattedText;
            
            // Scroll to top
            setTimeout(() => {
                consoleBody.scrollTop = 0;
            }, 50);
            
            // Add keyboard navigation
            setupHelpKeyboardNavigation();
            
        })
        .catch(error => {
            console.error('Error loading help:', error);
            
            // Fallback
            const helpContent = document.getElementById('helpContent');
            if (helpContent) {
                helpContent.innerHTML = `
                    <div style="color: #e74c3c; padding: 20px; text-align: center;">
                        <i class="fas fa-exclamation-triangle"></i> Πρόβλημα φόρτωσης βοήθειας<br>
                        <small>Ελέγξτε το αρχείο help.txt στον φάκελο</small>
                    </div>
                `;
            }
            
            // Add keyboard navigation even for fallback
            setupHelpKeyboardNavigation();
        });
}

/**
 * Μορφοποιεί το κείμενο βοήθειας για εμφάνιση
 */
function formatHelpText(text) {
    // Χωρίζουμε τις γραμμές
    const lines = text.split('\n');
    let formattedHTML = '';
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine === '') {
            formattedHTML += '<div style="height: 5px;"></div>';
        }
        else if (line.startsWith('# ')) {
            // Κύριοι τίτλοι
            formattedHTML += `<div style="color: #f39c12; font-weight: bold; font-size: 1.1rem; margin: 15px 0 5px 0; border-bottom: 2px solid #f39c12; padding-bottom: 5px;">${line.substring(2)}</div>`;
        }
        else if (line.startsWith('## ')) {
            // Τίτλοι ενότητας
            formattedHTML += `<div style="color: #3498db; font-weight: bold; margin: 12px 0 5px 10px;">${line.substring(3)}</div>`;
        }
        else if (line.startsWith('### ')) {
            // Υποενότητες
            formattedHTML += `<div style="color: #2ecc71; margin: 10px 0 5px 20px;">${line.substring(4)}</div>`;
        }
        else if (line.includes('┌') || line.includes('├') || line.includes('└') || 
                 line.includes('│') || line.includes('──') || line.includes('┘') || line.includes('┐')) {
            // Πίνακες
            formattedHTML += `<div style="color: #9b59b6; font-family: 'Courier New', monospace; margin: 5px 0 5px 30px;">${line}</div>`;
        }
        else if (line.startsWith('• ') || /^\d+\.\s/.test(line)) {
            // Σημεία λίστας
            formattedHTML += `<div style="color: #ecf0f1; margin: 3px 0 3px 40px;">${line}</div>`;
        }
        else if (line.includes('📖') || line.includes('🔹') || line.includes('▶') || 
                 line.includes('📋') || line.includes('🚀') || line.includes('⚠️') ||
                 line.includes('🎯') || line.includes('🔑') || line.includes('📞') ||
                 line.includes('🔍') || line.includes('⚙️') || line.includes('🔧') ||
                 line.includes('🌐') || line.includes('💾') || line.includes('⌨️') ||
                 line.includes('🚦') || line.includes('🐛') || line.includes('🔌')) {
            // Γραμμές με emoji
            formattedHTML += `<div style="color: #bdc3c7; margin: 8px 0 8px 20px; font-weight: 500;">${line}</div>`;
        }
        else if (line.startsWith('[') && line.includes(']')) {
            // Συντόμευσεις πληκτρολογίου
            formattedHTML += `<div style="color: #f1c40f; margin: 5px 0 5px 30px; font-weight: 500;">${line}</div>`;
        }
        else {
            // Κανονικό κείμενο
            // Αν είναι πολύ μακρύ, το τυλίγουμε
            if (line.length > 100) {
                formattedHTML += `<div style="color: #ecf0f1; margin: 5px 0 5px 30px; word-wrap: break-word; line-height: 1.5;">${line}</div>`;
            } else {
                formattedHTML += `<div style="color: #ecf0f1; margin: 5px 0 5px 30px;">${line}</div>`;
            }
        }
    });
    
    return formattedHTML;
}

/**
 * Ρυθμίζει τα πλήκτρα πλοήγησης για τη λειτουργία βοήθειας
 */
function setupHelpKeyboardNavigation() {
    const consoleElement = document.getElementById('console');
    const consoleBody = document.getElementById('consoleBody');
    
    if (!consoleElement || !consoleBody) return;
    
    // Create a unique handler for help navigation
    const helpKeyHandler = function(event) {
        if (event.key === 'Escape' || event.key === 'Esc') {
            // Close help mode
            exitHelpMode();
            event.preventDefault();
        } else if (event.key === 'Home') {
            // Scroll to top
            consoleBody.scrollTop = 0;
            event.preventDefault();
        } else if (event.key === 'End') {
            // Scroll to bottom
            consoleBody.scrollTop = consoleBody.scrollHeight;
            event.preventDefault();
        } else if (event.key === 'PageUp') {
            // Page up
            consoleBody.scrollTop -= 300;
            event.preventDefault();
        } else if (event.key === 'PageDown') {
            // Page down
            consoleBody.scrollTop += 300;
            event.preventDefault();
        } else if (event.key === 'ArrowUp') {
            // Arrow up
            consoleBody.scrollTop -= 50;
            event.preventDefault();
        } else if (event.key === 'ArrowDown') {
            // Arrow down
            consoleBody.scrollTop += 50;
            event.preventDefault();
        }
    };
    
    // Add the keyboard listener
    document.addEventListener('keydown', helpKeyHandler);
    
    // Store the handler reference for removal
    window.currentHelpKeyHandler = helpKeyHandler;
}

/**
 * Εξόδος από τη λειτουργία βοήθειας
 */
function exitHelpMode() {
    const consoleElement = document.getElementById('console');
    const consoleBody = document.getElementById('consoleBody');
    
    if (!consoleElement) return;
    
    // Restore console to normal size
    consoleElement.style.height = '200px';
    consoleElement.style.zIndex = '1000';
    consoleElement.classList.remove('console-fullscreen');
    
    // Clear console completely
    consoleBody.innerHTML = '';
    
    // Add a fresh console start message (χωρίς addToConsole)
    const welcomeDiv1 = document.createElement('div');
    welcomeDiv1.className = 'log-message info';
    welcomeDiv1.textContent = '[Σύστημα] Προσομοιωτής δικτύων έτοιμος';
    consoleBody.appendChild(welcomeDiv1);
    
    const welcomeDiv2 = document.createElement('div');
    welcomeDiv2.className = 'log-message info';
    welcomeDiv2.textContent = '[Σύστημα] Κάντε κλικ σε συσκευές για να τις προσθέσετε στο workspace';
    consoleBody.appendChild(welcomeDiv2);
    
    // Remove keyboard listener
    if (window.currentHelpKeyHandler) {
        document.removeEventListener('keydown', window.currentHelpKeyHandler);
        window.currentHelpKeyHandler = null;
    }
}

/**
 * Εγκαθιστά το πλήκτρο F1 για βοήθεια
 */
function setupHelpShortcut() {
    document.addEventListener('keydown', function(event) {
        if (event.key === 'F1') {
            event.preventDefault();
            showHelp();
        }
    });
}

/**
 * Εγκαθιστά το κουμπί βοήθειας
 */
function setupHelpButton() {
    const helpButton = document.querySelector('[onclick*="showHelp"]');
    
    if (helpButton) {
        // Replace onclick with our function
        helpButton.setAttribute('onclick', 'showHelp()');
        
        // Also add enhanced styling if needed
        helpButton.classList.add('help-button-highlight');
    }
}

/**
 * Αρχικοποιεί τη λειτουργία βοήθειας
 */
function initializeHelpSystem() {
    // Setup F1 shortcut
    setupHelpShortcut();
    
    // Setup help button
    setupHelpButton();
    
    // Add CSS class for help button if not already in style.css
    addHelpButtonStyles();
    
    console.log('Help system initialized');
}

/**
 * Προσθέτει CSS styles για το κουμπί βοήθειας και τη βοήθεια
 */
function addHelpButtonStyles() {
    // Check if styles already exist
    if (document.querySelector('#help-button-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'help-button-styles';
    style.textContent = `
        .help-button-highlight {
            background: linear-gradient(135deg, #9b59b6, #8e44ad) !important;
            color: white !important;
            border: 2px solid white !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 12px rgba(155, 89, 182, 0.4) !important;
            position: relative;
        }
        
        .help-button-highlight:hover {
            background: linear-gradient(135deg, #8e44ad, #7d3c98) !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px rgba(155, 89, 182, 0.6) !important;
        }
        
        .help-button-highlight i {
            animation: help-icon-float 3s ease-in-out infinite;
        }
        
        @keyframes help-icon-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-2px) rotate(5deg); }
        }
        
        .console-fullscreen {
            height: 80vh !important;
            max-height: 80vh !important;
            z-index: 2000 !important;
            background: #0f1419 !important;
            transition: height 0.3s ease;
        }
        
        .console-fullscreen .console-body {
            font-size: 0.9rem !important;
            line-height: 1.4 !important;
            overflow-y: auto !important;
            padding: 0 !important;
        }
        
        .help-header {
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-bottom: 1px solid #34495e;
        }
        
        .help-title {
            color: #f39c12;
            font-weight: bold;
            font-size: 1.1rem;
            text-align: center;
            margin-bottom: 5px;
        }
        
        .help-separator {
            color: #3498db;
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            text-align: center;
            margin: 5px 0;
        }
        
        .help-content {
            padding: 15px;
            max-height: 65vh;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
        }
        
        .help-footer {
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-top: 1px solid #34495e;
        }
        
        .help-navigation {
            color: #ecf0f1;
            text-align: center;
            font-size: 0.85rem;
            margin-top: 5px;
        }
        
        /* Better scrollbar for help content */
        .help-content::-webkit-scrollbar {
            width: 8px;
        }
        
        .help-content::-webkit-scrollbar-track {
            background: #1a252f;
            border-radius: 4px;
        }
        
        .help-content::-webkit-scrollbar-thumb {
            background: #3498db;
            border-radius: 4px;
        }
        
        .help-content::-webkit-scrollbar-thumb:hover {
            background: #2980b9;
        }
        
        .console-fullscreen .console-body::-webkit-scrollbar {
            width: 12px;
        }
        
        .console-fullscreen .console-body::-webkit-scrollbar-track {
            background: #1a252f;
        }
        
        .console-fullscreen .console-body::-webkit-scrollbar-thumb {
            background: #3498db;
            border-radius: 6px;
        }
        
        .console-fullscreen .console-body::-webkit-scrollbar-thumb:hover {
            background: #2980b9;
        }
    `;
    
    document.head.appendChild(style);
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHelpSystem);
} else {
    initializeHelpSystem();
}

// Export functions for global use
window.showHelp = showHelp;
window.exitHelpMode = exitHelpMode;
window.initializeHelpSystem = initializeHelpSystem;
