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
class ModelsLoader {
    constructor() {
        this.models = [
            { name: "Απλό LAN", file: "Simple_Lan.json", icon: "🏠", color: "#2ecc71" },
            { name: "2 Υποδίκτυα -> 1 Switch", file: "2_subnets_switch.json", icon: "🌐", color: "#3498db" },
            { name: "Πλήρες LAN -> WAN", file: "Office_with_2_Subnets_a_Router_Internet.json", icon: "🔗", color: "#9b59b6" }
        ];
        
        this.currentModal = null;
        this.setupMoreButton();
        this.setupThemeListener();
    }

    checkDarkTheme() {
        // Έλεγχος για dark theme με πολλαπλούς τρόπους
        const html = document.documentElement;
        const body = document.body;
        
        // 1. Προτιμούμενα από CSS custom properties
        if (html.style.getPropertyValue('--theme') === 'dark' ||
            body.style.getPropertyValue('--theme') === 'dark') {
            return true;
        }
        
        // 2. Classes
        const darkClasses = ['dark', 'dark-mode', 'dark-theme', 'theme-dark'];
        if (darkClasses.some(c => html.classList.contains(c) || body.classList.contains(c))) {
            return true;
        }
        
        // 3. Data attributes
        if (html.getAttribute('data-theme') === 'dark' ||
            body.getAttribute('data-theme') === 'dark') {
            return true;
        }
        
        // 4. Media query
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return true;
        }
        
        // 5. Έλεγχος χρώματος background
        try {
            const bgColor = getComputedStyle(document.body).backgroundColor;
            const rgb = bgColor.match(/\d+/g);
            if (rgb) {
                const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                return brightness < 150;
            }
        } catch (e) {
            console.log('Could not detect theme from background color');
        }
        
        return false;
    }

    getThemeColors() {
        const isDark = this.checkDarkTheme();
        
        if (isDark) {
            // Dark theme colors
            return {
                isDark: true,
                background: '#1e1e1e',
                surface: '#2d2d2d',
                text: '#e0e0e0',
                textSecondary: '#aaaaaa',
                border: '#404040',
                hover: '#3a3a3a',
                headerBg: '#252525',
                footerBg: '#252525',
                buttonBg: '#404040',
                buttonHover: '#505050',
                buttonText: '#ffffff',
                overlay: 'rgba(0, 0, 0, 0.75)',
                shadow: '0 10px 30px rgba(0,0,0,0.4)'
            };
        } else {
            // Light theme colors
            return {
                isDark: false,
                background: '#ffffff',
                surface: '#f8f9fa',
                text: '#2c3e50',
                textSecondary: '#6c757d',
                border: '#dee2e6',
                hover: '#e9ecef',
                headerBg: '#f8f9fa',
                footerBg: '#f8f9fa',
                buttonBg: '#6c757d',
                buttonHover: '#5a6268',
                buttonText: '#ffffff',
                overlay: 'rgba(0, 0, 0, 0.5)',
                shadow: '0 10px 30px rgba(0,0,0,0.15)'
            };
        }
    }

    setupMoreButton() {
        const loadModelBtn = document.getElementById('loadModelBtn');
        if (loadModelBtn) {
            loadModelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showModal();
            });
            console.log('✅ More... button initialized');
        }
    }

    setupThemeListener() {
        // Ακούει για αλλαγές στο theme
        if (window.matchMedia) {
            const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeMediaQuery.addEventListener('change', (e) => {
                if (this.currentModal) {
                    this.updateModalTheme();
                }
            });
        }
    }

    showModal() {
        if (this.currentModal) {
            this.currentModal.remove();
        }
        
        const colors = this.getThemeColors();
        
        const modalHTML = `
            <div class="models-modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${colors.overlay};
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(3px);
                animation: fadeIn 0.3s ease;
            ">
                <div class="models-modal" style="
                    background: ${colors.background};
                    border-radius: 12px;
                    width: 420px;
                    max-width: 95%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: ${colors.shadow};
                    border: 1px solid ${colors.border};
                    overflow: hidden;
                    color: ${colors.text};
                    animation: slideUp 0.3s ease;
                ">
                    <div class="models-modal-header" style="
                        padding: 20px;
                        border-bottom: 1px solid ${colors.border};
                        background: ${colors.headerBg};
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 12px; font-weight: 600;">
                            <i class="fas fa-folder-open" style="color: ${colors.text}"></i>
                            Προκαθορισμένα Μοντέλα
                        </h3>
                        <button class="modal-close-btn" style="
                            background: none;
                            border: none;
                            font-size: 26px;
                            cursor: pointer;
                            color: ${colors.textSecondary};
                            padding: 0;
                            width: 32px;
                            height: 32px;
                            line-height: 1;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: background 0.2s;
                        " title="Κλείσιμο">&times;</button>
                    </div>
                    
                    <div class="models-list" style="
                        flex: 1;
                        padding: 20px;
                        overflow-y: auto;
                    ">
                        ${this.models.map(model => `
                            <div class="model-item" data-file="${model.file}" style="
                                display: flex;
                                align-items: center;
                                padding: 14px 16px;
                                border: 1px solid ${colors.border};
                                border-radius: 8px;
                                margin-bottom: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                background: ${colors.surface};
                            ">
                                <span class="model-icon" style="
                                    font-size: 1.6rem;
                                    margin-right: 14px;
                                    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
                                ">${model.icon}</span>
                                <span class="model-name" style="
                                    flex: 1;
                                    font-weight: 500;
                                    font-size: 1rem;
                                ">${model.name}</span>
                                <button class="model-load-btn" data-file="${model.file}" style="
                                    background: ${model.color};
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    padding: 8px 18px;
                                    cursor: pointer;
                                    font-size: 0.9rem;
                                    font-weight: 600;
                                    transition: all 0.2s;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                ">
                                    Φόρτωση
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="models-modal-footer" style="
                        padding: 18px 20px;
                        border-top: 1px solid ${colors.border};
                        background: ${colors.footerBg};
                        text-align: center;
                    ">
                        <button class="modal-cancel-btn" style="
                            background: ${colors.buttonBg};
                            color: ${colors.buttonText};
                            border: none;
                            border-radius: 6px;
                            padding: 10px 30px;
                            cursor: pointer;
                            font-size: 0.95rem;
                            font-weight: 600;
                            transition: background 0.2s;
                            min-width: 120px;
                        ">
                            Κλείσιμο
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        this.currentModal = modalContainer;
        
        this.setupModalEvents(modalContainer);
        this.addAnimations();
    }

    updateModalTheme() {
        if (!this.currentModal) return;
        
        const colors = this.getThemeColors();
        const modal = this.currentModal.querySelector('.models-modal');
        const overlay = this.currentModal.querySelector('.models-modal-overlay');
        const header = modal.querySelector('.models-modal-header');
        const footer = modal.querySelector('.models-modal-footer');
        const modelItems = modal.querySelectorAll('.model-item');
        
        // Ενημέρωση χρωμάτων
        overlay.style.background = colors.overlay;
        modal.style.background = colors.background;
        modal.style.borderColor = colors.border;
        modal.style.color = colors.text;
        modal.style.boxShadow = colors.shadow;
        
        header.style.background = colors.headerBg;
        header.style.borderColor = colors.border;
        
        footer.style.background = colors.footerBg;
        footer.style.borderColor = colors.border;
        
        modelItems.forEach(item => {
            item.style.background = colors.surface;
            item.style.borderColor = colors.border;
        });
        
        // Update button colors
        const closeBtn = modal.querySelector('.modal-close-btn');
        const cancelBtn = modal.querySelector('.modal-cancel-btn');
        
        closeBtn.style.color = colors.textSecondary;
        cancelBtn.style.background = colors.buttonBg;
        cancelBtn.style.color = colors.buttonText;
    }

    setupModalEvents(modalContainer) {
        const overlay = modalContainer.querySelector('.models-modal-overlay');
        const modal = modalContainer.querySelector('.models-modal');
        const closeBtn = modalContainer.querySelector('.modal-close-btn');
        const cancelBtn = modalContainer.querySelector('.modal-cancel-btn');
        const loadBtns = modalContainer.querySelectorAll('.model-load-btn');
        const modelItems = modalContainer.querySelectorAll('.model-item');

        // Hover effects
        modelItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const colors = this.getThemeColors();
                item.style.background = colors.hover;
                item.style.transform = 'translateY(-3px)';
                item.style.boxShadow = `0 4px 12px rgba(0,0,0,${colors.isDark ? '0.3' : '0.1'})`;
            });
            
            item.addEventListener('mouseleave', () => {
                const colors = this.getThemeColors();
                item.style.background = colors.surface;
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
            });
            
            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('model-load-btn')) return;
                const filename = item.dataset.file;
                modalContainer.remove();
                this.currentModal = null;
                await this.loadModel(filename);
            });
        });

        loadBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.05)';
                btn.style.filter = 'brightness(1.1)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                btn.style.filter = 'none';
            });
            
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const filename = btn.dataset.file;
                modalContainer.remove();
                this.currentModal = null;
                await this.loadModel(filename);
            });
        });

        closeBtn.addEventListener('mouseenter', () => {
            const colors = this.getThemeColors();
            closeBtn.style.background = colors.hover;
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });
        
        closeBtn.addEventListener('click', () => {
            modalContainer.remove();
            this.currentModal = null;
        });

        cancelBtn.addEventListener('mouseenter', () => {
            const colors = this.getThemeColors();
            cancelBtn.style.background = colors.buttonHover;
        });
        
        cancelBtn.addEventListener('mouseleave', () => {
            const colors = this.getThemeColors();
            cancelBtn.style.background = colors.buttonBg;
        });
        
        cancelBtn.addEventListener('click', () => {
            modalContainer.remove();
            this.currentModal = null;
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                modalContainer.remove();
                this.currentModal = null;
            }
        });

        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape' && modalContainer.parentNode) {
                modalContainer.remove();
                this.currentModal = null;
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    addAnimations() {
        if (document.getElementById('models-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'models-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { 
                    opacity: 0; 
                    transform: translateY(30px); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0); 
                }
            }
            
            .modal-close-btn:hover {
                background: rgba(0,0,0,0.1) !important;
            }
            
            @media (max-width: 480px) {
                .models-modal {
                    width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    border-radius: 0 !important;
                    max-width: 100% !important;
                }
                
                .models-modal-overlay {
                    padding: 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    async loadModel(filename) {
        try {
            console.log(`📥 Φόρτωση: ${filename}`);
            
            if (window.addToConsole) {
                window.addToConsole(`Φόρτωση μοντέλου: ${filename}...`, 'info');
            }
            
            const response = await fetch(`data/models/${filename}`);
            if (!response.ok) {
                throw new Error(`Το αρχείο ${filename} δεν βρέθηκε`);
            }
            
            const jsonData = await response.json();
            
            if (window.workspaceManager && window.workspaceManager.loadFromFile) {
                const jsonString = JSON.stringify(jsonData);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const file = new File([blob], filename, { type: 'application/json' });
                
                await window.workspaceManager.loadFromFile({
                    target: { files: [file] }
                });
                
                console.log(`✅ Επιτυχής φόρτωση: ${filename}`);
                
                if (window.addToConsole) {
                    window.addToConsole(`✅ Μοντέλο "${jsonData.metadata?.name || filename}" φορτώθηκε!`, 'success');
                }
                
            } else {
                console.warn('Workspace manager not ready');
                setTimeout(() => this.loadModel(filename), 500);
            }
            
        } catch (error) {
            console.error('Σφάλμα φόρτωσης:', error);
            
            if (window.addToConsole) {
                window.addToConsole(`❌ Σφάλμα: ${error.message}`, 'error');
            }
            
            alert(`Σφάλμα: ${error.message}\n\nΒεβαιωθείτε ότι το αρχείο ${filename} υπάρχει στον φάκελο data/models/`);
        }
    }
}

// Αρχικοποίηση
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.modelsLoader = new ModelsLoader();
            console.log('✅ Enhanced Models Loader initialized');
        }, 300);
    });
} else {
    setTimeout(() => {
        window.modelsLoader = new ModelsLoader();
        console.log('✅ Enhanced Models Loader initialized');
    }, 300);
}
