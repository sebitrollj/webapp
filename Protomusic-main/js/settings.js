/**
 * ProtoMusic Settings Manager
 * Handles premium visual effects and customization
 */

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.init();
    }

    getDefaultSettings() {
        return {
            accentColor: '#FF0000',
            theme: 'dark',
            particles: false,
            glassIntensity: 30,
            neonGlow: false,
            animations: true,
            aurora: false,
            ambientBackground: false,
            visualizer: false,
            autoplay: true,
            videoMode: true,
            maxQueueSize: 50,
            skipSeason8Intro: false,
            bassBoost: 0
        };
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('protomusic_settings');
            return saved ? { ...this.getDefaultSettings(), ...JSON.parse(saved) } : this.getDefaultSettings();
        } catch {
            return this.getDefaultSettings();
        }
    }

    saveSettings() {
        localStorage.setItem('protomusic_settings', JSON.stringify(this.settings));
    }

    init() {
        this.initColorPicker();
        this.initThemeToggle();
        this.initToggles();
        this.initSliders();
        this.initParticles();
        this.initAurora();
        // Apply settings AFTER all elements are initialized
        this.applySettings();
    }

    applySettings() {
        const root = document.documentElement;
        const body = document.body;

        // Accent color
        root.style.setProperty('--accent-primary', this.settings.accentColor);
        root.style.setProperty('--accent-secondary', this.adjustBrightness(this.settings.accentColor, 30));
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${this.settings.accentColor} 0%, ${this.adjustBrightness(this.settings.accentColor, 50)} 100%)`);

        // Accent RGB for rgba usage
        const rgb = this.hexToRgb(this.settings.accentColor);
        root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

        // Theme
        body.classList.remove('theme-dark', 'theme-light', 'theme-midnight', 'theme-colored');
        body.classList.add(`theme-${this.settings.theme}`);

        // Dynamic Background for Colored Theme
        if (this.settings.theme === 'colored') {
            const bgPrimary = this.adjustBrightness(this.settings.accentColor, -85);
            const bgSecondary = this.adjustBrightness(this.settings.accentColor, -80);
            const bgTertiary = this.adjustBrightness(this.settings.accentColor, -75);

            root.style.setProperty('--bg-primary', bgPrimary);
            root.style.setProperty('--bg-secondary', bgSecondary);
            root.style.setProperty('--bg-tertiary', bgTertiary);
            root.style.setProperty('--bg-hover', this.adjustBrightness(this.settings.accentColor, -65));
        } else {
            // Reset to allow CSS classes to take over
            root.style.removeProperty('--bg-primary');
            root.style.removeProperty('--bg-secondary');
            root.style.removeProperty('--bg-tertiary');
            root.style.removeProperty('--bg-hover');
        }

        // Glassmorphism
        const glassOpacity = 1 - (this.settings.glassIntensity / 200);
        const glassBlur = (this.settings.glassIntensity / 100) * 20;
        root.style.setProperty('--glass-opacity', glassOpacity);
        root.style.setProperty('--glass-blur', `${glassBlur}px`);
        body.classList.toggle('glass-effect', this.settings.glassIntensity > 0);

        // Neon glow
        body.classList.toggle('neon-glow', this.settings.neonGlow);

        // Animations
        body.classList.toggle('no-animations', !this.settings.animations);

        // Aurora
        const aurora = document.getElementById('auroraBg');
        if (aurora) {
            aurora.classList.toggle('active', this.settings.aurora);
        }

        // Particles
        this.toggleParticles(this.settings.particles);
    }

    initColorPicker() {
        const colorPicker = document.getElementById('accentColorPicker');
        if (!colorPicker) return;

        const buttons = colorPicker.querySelectorAll('.color-btn[data-color]');
        const customLabel = document.getElementById('customColorLabel');
        const customInput = document.getElementById('customColorInput');

        // Restore active state from saved settings
        let isCustomActive = true;
        buttons.forEach(btn => {
            if (btn.dataset.color === this.settings.accentColor) {
                btn.classList.add('active');
                isCustomActive = false;
            } else {
                btn.classList.remove('active');
            }
        });

        // If no preset matched, it's a custom color — show it on the custom button
        if (isCustomActive && customLabel && customInput) {
            customInput.value = this.settings.accentColor;
            customLabel.style.background = this.settings.accentColor;
            customLabel.classList.add('active');
        }

        // Preset color buttons
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                if (customLabel) customLabel.classList.remove('active');
                btn.classList.add('active');
                this.settings.accentColor = btn.dataset.color;
                this.saveSettings();
                this.applySettings();
            });
        });

        // Custom color input
        if (customInput && customLabel) {
            customInput.addEventListener('input', (e) => {
                const color = e.target.value;
                // Update the button background to reflect the picked color
                customLabel.style.setProperty('--btn-color', color);
                customLabel.style.background = color;
                buttons.forEach(b => b.classList.remove('active'));
                customLabel.classList.add('active');
                this.settings.accentColor = color;
                this.saveSettings();
                this.applySettings();
            });

            // Open picker when label is clicked (label wraps hidden input)
            customLabel.addEventListener('click', () => {
                customInput.click();
            });
        }
    }

    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        const buttons = themeToggle.querySelectorAll('.theme-btn');

        // Set initial active
        buttons.forEach(btn => {
            if (btn.dataset.theme === this.settings.theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.theme = btn.dataset.theme;
                this.saveSettings();
                this.applySettings();
            });
        });
    }

    initToggles() {
        const toggleMap = {
            'particlesToggle': 'particles',
            'neonGlowToggle': 'neonGlow',
            'animationsToggle': 'animations',
            'auroraToggle': 'aurora',
            'ambientModeToggle': 'ambientBackground',
            'visualizerToggle': 'visualizer',
            'autoplayToggle': 'autoplay',
            'videoModeToggle': 'videoMode'
        };

        Object.entries(toggleMap).forEach(([id, setting]) => {
            const toggle = document.getElementById(id);
            if (toggle) {
                // Set initial state from saved settings
                toggle.checked = Boolean(this.settings[setting]);

                toggle.addEventListener('change', () => {
                    this.settings[setting] = toggle.checked;
                    this.saveSettings();

                    // Special handling for ambient background
                    if (setting === 'ambientBackground') {
                        if (toggle.checked && window.app) {
                            // Re-load featured to apply color
                            app.loadFeatured();
                        } else if (window.app) {
                            app.clearAmbientBackground();
                        }
                    } else {
                        this.applySettings();
                    }
                });
            }
        });
    }

    initSliders() {
        // Glass intensity slider
        const glassSlider = document.getElementById('glassIntensity');
        const glassValue = document.getElementById('glassValue');

        if (glassSlider && glassValue) {
            glassSlider.value = this.settings.glassIntensity;
            glassValue.textContent = `${this.settings.glassIntensity}%`;

            glassSlider.addEventListener('input', () => {
                this.settings.glassIntensity = parseInt(glassSlider.value);
                glassValue.textContent = `${this.settings.glassIntensity}%`;
                this.saveSettings();
                this.applySettings();
            });
        }

        // Bass booster slider
        const bassSlider = document.getElementById('bassBoostSlider');
        const bassValue = document.getElementById('bassValue');

        if (bassSlider && bassValue) {
            bassSlider.value = this.settings.bassBoost;
            bassValue.textContent = `${this.settings.bassBoost} dB`;

            bassSlider.addEventListener('input', () => {
                this.settings.bassBoost = parseInt(bassSlider.value);
                bassValue.textContent = `${this.settings.bassBoost} dB`;
                this.saveSettings();

                // Apply to player
                if (typeof player !== 'undefined' && player.setBassBoost) {
                    player.setBassBoost(this.settings.bassBoost);
                }
            });
        }

        // Max Queue Size slider
        const maxQueueSlider = document.getElementById('maxQueueSlider');
        const maxQueueValue = document.getElementById('maxQueueValue');

        if (maxQueueSlider && maxQueueValue) {
            maxQueueSlider.value = this.settings.maxQueueSize;
            maxQueueValue.textContent = this.settings.maxQueueSize;

            maxQueueSlider.addEventListener('input', () => {
                this.settings.maxQueueSize = parseInt(maxQueueSlider.value);
                maxQueueValue.textContent = this.settings.maxQueueSize;
                this.saveSettings();
            });
        }

        // Skip Season 8 Intro toggle
        const skipSeason8Toggle = document.getElementById('skipSeason8Toggle');
        if (skipSeason8Toggle) {
            skipSeason8Toggle.checked = Boolean(this.settings.skipSeason8Intro);
            skipSeason8Toggle.addEventListener('change', () => {
                this.settings.skipSeason8Intro = skipSeason8Toggle.checked;
                this.saveSettings();
            });
        }

        // Discord Rich Presence toggle
        const discordRpcToggle = document.getElementById('discordRpcToggle');
        if (discordRpcToggle) {
            const enabled = localStorage.getItem('protomusic_discord_rpc') !== 'false';
            discordRpcToggle.checked = enabled;

            discordRpcToggle.addEventListener('change', () => {
                const enabled = discordRpcToggle.checked;
                localStorage.setItem('protomusic_discord_rpc', enabled);

                // Notify main process to enable/disable Discord RPC
                if (typeof setDiscordRPCEnabled === 'function') {
                    setDiscordRPCEnabled(enabled);
                }
            });
        }
    }

    // Particles system
    initParticles() {
        if (!document.getElementById('particlesCanvas')) {
            const canvas = document.createElement('canvas');
            canvas.id = 'particlesCanvas';
            canvas.className = 'particles-canvas';
            // Inline styles to ensure they override any conflicting rules
            canvas.style.cssText = `
                display: none;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                pointer-events: none;
                z-index: 15;
            `;
            document.body.appendChild(canvas); // Append to end of body so it stacks on top properly
        }
    }

    toggleParticles(enabled) {
        const canvas = document.getElementById('particlesCanvas');
        if (!canvas) return;

        if (enabled) {
            canvas.style.display = 'block';
            this.startParticles(canvas);
        } else {
            canvas.style.display = 'none';
            this.stopParticles();
        }
    }

    startParticles(canvas) {
        if (this.particleAnimation) return;

        const ctx = canvas.getContext('2d');
        const particles = [];
        const particleCount = 50;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Create particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.2
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const rgb = this.hexToRgb(this.settings.accentColor);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
                ctx.fill();
            });

            this.particleAnimation = requestAnimationFrame(animate);
        };

        animate();
    }

    stopParticles() {
        if (this.particleAnimation) {
            cancelAnimationFrame(this.particleAnimation);
            this.particleAnimation = null;
        }
    }

    initAurora() {
        if (!document.getElementById('auroraBg')) {
            const aurora = document.createElement('div');
            aurora.id = 'auroraBg';
            aurora.className = 'aurora-bg';
            document.body.insertBefore(aurora, document.body.firstChild);
        }
    }

    // Utility functions
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    }

    adjustBrightness(hex, percent) {
        const rgb = this.hexToRgb(hex);
        const adjust = (value) => {
            return Math.min(255, Math.max(0, value + (255 * percent / 100)));
        };
        const r = Math.round(adjust(rgb.r)).toString(16).padStart(2, '0');
        const g = Math.round(adjust(rgb.g)).toString(16).padStart(2, '0');
        const b = Math.round(adjust(rgb.b)).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
}

// Initialize settings manager
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});
