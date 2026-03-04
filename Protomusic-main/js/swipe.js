/**
 * ProtoMusic - Mobile Swipe Gesture Handler
 * Gestes supportés :
 *  - Swipe G/D sur le contenu principal → naviguer entre les pages
 *  - Swipe Haut sur le mini-player → ouvrir le full player
 *  - Swipe Bas sur le mini-player → (réservé)
 *  - Swipe G/D sur le mini-player → piste précédente / suivante
 *  - Swipe Bas sur le full player → fermer le full player
 *  - Swipe G/D sur le full player → piste précédente / suivante
 */

class SwipeManager {
    constructor() {
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;

        // Threshold (px) to count as a swipe
        this.MIN_DISTANCE = 50;
        this.MAX_PERPENDICULAR = 80;
        this.MAX_DURATION = 400; // ms

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setup());
        } else {
            this._setup();
        }
    }

    _setup() {
        this._setupDragHandles();
        this._setupMiniPlayer();
        this._setupFullPlayer();
        this._setupPageSwipe();
    }

    /* ─── Helpers ─── */

    _onSwipe(el, handler) {
        if (!el) return;

        el.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            this.startX = t.clientX;
            this.startY = t.clientY;
            this.startTime = Date.now();
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - this.startX;
            const dy = t.clientY - this.startY;
            const dt = Date.now() - this.startTime;

            if (dt > this.MAX_DURATION) return;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx >= this.MIN_DISTANCE && absDy < this.MAX_PERPENDICULAR) {
                handler(dx > 0 ? 'right' : 'left', absDx, absDy);
            } else if (absDy >= this.MIN_DISTANCE && absDx < this.MAX_PERPENDICULAR) {
                handler(dy > 0 ? 'down' : 'up', absDx, absDy);
            }
        }, { passive: true });
    }

    _getPlayer() {
        return window.player || null;
    }

    _getApp() {
        return window.app || null;
    }

    /* ─── Page order for navigation ─── */

    _getPages() {
        return ['home', 'explore', 'library', 'history', 'kikiskotheque', 'settings'];
    }

    _getCurrentPage() {
        const app = this._getApp();
        return app ? app.currentPage : null;
    }

    /* ─── Drag Handle pills (tap to open/close) ─── */

    _setupDragHandles() {
        // Mini player drag handle pill → open full player on tap
        const miniHandle = document.getElementById('miniDragHandle');
        if (miniHandle) {
            miniHandle.addEventListener('click', () => {
                const p = this._getPlayer();
                p && p.showFullPlayer && p.showFullPlayer();
            });
        }

        // Full player drag handle pill → close full player on tap
        const fullHandle = document.getElementById('fullDragHandle');
        if (fullHandle) {
            fullHandle.addEventListener('click', () => {
                const p = this._getPlayer();
                p && p.hideFullPlayer && p.hideFullPlayer();
            });
        }
    }

    /* ─── Mini Player swipe ─── */

    _setupMiniPlayer() {
        const miniPlayer = document.getElementById('miniPlayer');
        if (!miniPlayer) return;

        this._onSwipe(miniPlayer, (dir) => {
            const p = this._getPlayer();
            if (!p) return;

            switch (dir) {
                case 'up':
                    // Open full player
                    p.showFullPlayer && p.showFullPlayer();
                    this._feedback('⬆️ Lecteur ouvert');
                    break;
                case 'left':
                    // Next track
                    p.next && p.next();
                    this._feedback('⏭ Suivant');
                    break;
                case 'right':
                    // Previous track
                    p.previous && p.previous();
                    this._feedback('⏮ Précédent');
                    break;
            }
        });
    }

    /* ─── Full Player swipe (drag-to-dismiss) ─── */

    _setupFullPlayer() {
        const overlay = document.getElementById('fullPlayerOverlay');
        if (!overlay) return;

        // We animate the inner .full-player panel, not the overlay itself
        const getPanel = () => overlay.querySelector('.full-player');

        let startY = 0, startX = 0;
        let dragging = false;
        let currentDy = 0;

        const THRESHOLD = () => window.innerHeight * 0.22; // 22% screen height to dismiss

        const onStart = (e) => {
            // Only intercept if full player is visible
            if (overlay.classList.contains('hidden')) return;
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            dragging = false;
            currentDy = 0;
            const panel = getPanel();
            if (panel) panel.style.transition = 'none';
        };

        const onMove = (e) => {
            if (overlay.classList.contains('hidden')) return;
            const dy = e.touches[0].clientY - startY;
            const dx = e.touches[0].clientX - startX;

            // If horizontal movement dominates, ignore (let track-change swipes pass)
            if (!dragging && Math.abs(dx) > Math.abs(dy) + 10) return;

            // Only respond to downward drag
            if (dy <= 0) return;

            dragging = true;
            currentDy = dy;

            const panel = getPanel();
            if (!panel) return;

            // Real-time transform: translate + scale-down as you drag
            const progress = Math.min(dy / (window.innerHeight * 0.5), 1);
            const scale = 1 - progress * 0.12;
            const opacity = Math.max(0.25, 1 - progress * 0.85);

            panel.style.transform = `translateY(${dy}px) scale(${scale})`;
            panel.style.opacity = opacity;
            panel.style.borderRadius = `${Math.min(dy * 0.08, 24)}px`;

            // Also fade the overlay background
            const bgAlpha = Math.max(0, 1 - progress * 1.4);
            overlay.style.backgroundColor = `rgba(0,0,0,${bgAlpha})`;
        };

        const onEnd = (e) => {
            if (overlay.classList.contains('hidden')) return;
            if (!dragging && currentDy === 0) return;

            const dy = e.changedTouches[0].clientY - startY;
            const dx = e.changedTouches[0].clientX - startX;
            const panel = getPanel();

            // Handle horizontal track-change swipes (not a downward drag)
            if (!dragging && Math.abs(dx) >= this.MIN_DISTANCE && Math.abs(dy) < this.MAX_PERPENDICULAR) {
                const p = this._getPlayer();
                if (p) {
                    if (dx < 0) { p.next?.(); this._feedback('⏭ Suivant'); }
                    else { p.previous?.(); this._feedback('⏮ Précédent'); }
                }
                return;
            }

            if (!panel) return;
            panel.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.28s ease, border-radius 0.28s ease';
            overlay.style.transition = 'background-color 0.28s ease';

            if (currentDy >= THRESHOLD()) {
                // Dismiss — animate panel off screen + fade overlay to transparent
                panel.style.transform = `translateY(${window.innerHeight}px) scale(0.88)`;
                panel.style.opacity = '0';
                overlay.style.backgroundColor = 'rgba(0,0,0,0)';

                // Use transitionend for exact timing (no fixed timeout)
                let dismissed = false;
                const dismiss = () => {
                    if (dismissed) return;
                    dismissed = true;

                    // Reset inline styles BEFORE calling hideFullPlayer
                    // so that when display:none is removed on next open, styles are clean
                    panel.style.transition = 'none';
                    panel.style.transform = '';
                    panel.style.opacity = '';
                    panel.style.borderRadius = '';
                    overlay.style.transition = 'none';
                    overlay.style.backgroundColor = '';

                    // Now hide via player (adds hidden class, restores body.overflow, etc.)
                    const p = this._getPlayer();
                    if (p?.hideFullPlayer) {
                        p.hideFullPlayer();
                    } else {
                        overlay.classList.add('hidden');
                        document.body.style.overflow = '';
                    }

                    // Force panel style cleanup on next frame
                    requestAnimationFrame(() => {
                        panel.style.transition = '';
                    });
                };

                panel.addEventListener('transitionend', dismiss, { once: true });
                // Fallback: ensure dismiss fires even if transitionend doesn't
                setTimeout(dismiss, 400);

            } else {
                // Snap back — restore overlay background instantly
                panel.style.transform = '';
                panel.style.opacity = '';
                panel.style.borderRadius = '';
                overlay.style.backgroundColor = '';
            }

            dragging = false;
            currentDy = 0;
        };

        // capture:true → fires BEFORE any child element (video, range input, buttons)
        overlay.addEventListener('touchstart', onStart, { passive: true, capture: true });
        overlay.addEventListener('touchmove', onMove, { passive: true, capture: true });
        overlay.addEventListener('touchend', onEnd, { passive: true, capture: true });
    }

    /* ─── Page navigation swipe ─── */

    _setupPageSwipe() {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;

        let swipeIndicator = null;

        mainContent.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            this.startX = t.clientX;
            this.startY = t.clientY;
            this.startTime = Date.now();
        }, { passive: true });

        // Visual drag feedback during swipe
        mainContent.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            const dx = t.clientX - this.startX;
            const dy = t.clientY - this.startY;

            // Only show indicator for horizontal swipes
            if (Math.abs(dx) > 20 && Math.abs(dy) < 60) {
                if (!swipeIndicator) {
                    swipeIndicator = this._createSwipeIndicator();
                    document.body.appendChild(swipeIndicator);
                }
                const opacity = Math.min(Math.abs(dx) / 150, 0.6);
                swipeIndicator.style.opacity = opacity;
                swipeIndicator.style.transform = `translateX(${dx > 0 ? '0' : 'auto'})`;
                swipeIndicator.querySelector('.swipe-arrow').textContent = dx > 0 ? '←' : '→';
                if (dx > 0) {
                    swipeIndicator.style.left = '0';
                    swipeIndicator.style.right = 'auto';
                } else {
                    swipeIndicator.style.right = '0';
                    swipeIndicator.style.left = 'auto';
                }
            }
        }, { passive: true });

        mainContent.addEventListener('touchend', (e) => {
            // Remove indicator
            if (swipeIndicator) {
                swipeIndicator.remove();
                swipeIndicator = null;
            }

            const t = e.changedTouches[0];
            const dx = t.clientX - this.startX;
            const dy = t.clientY - this.startY;
            const dt = Date.now() - this.startTime;

            if (dt > this.MAX_DURATION) return;
            if (Math.abs(dx) < this.MIN_DISTANCE) return;
            if (Math.abs(dy) > this.MAX_PERPENDICULAR) return;

            // Don't trigger if swiping on a scrollable horizontal element (video grids)
            const target = e.target.closest('.video-grid, .content-section, [class*="grid"]');
            if (target) {
                const isScrollable = target.scrollWidth > target.clientWidth;
                if (isScrollable) return;
            }

            const app = this._getApp();
            if (!app) return;

            const pages = this._getPages();
            const currentIndex = pages.indexOf(app.currentPage);
            if (currentIndex === -1) return;

            let nextIndex;
            if (dx < 0) {
                // Swipe left → next page
                nextIndex = Math.min(currentIndex + 1, pages.length - 1);
            } else {
                // Swipe right → previous page
                nextIndex = Math.max(currentIndex - 1, 0);
            }

            if (nextIndex !== currentIndex) {
                app.navigateTo(pages[nextIndex]);
                this._animatePageTransition(dx < 0 ? 'left' : 'right');
            }
        }, { passive: true });
    }

    /* ─── Visual feedback ─── */

    _feedback(text) {
        // Only show on mobile
        if (window.innerWidth > 768) return;

        const toast = document.createElement('div');
        toast.className = 'swipe-toast';
        toast.textContent = text;
        toast.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%) translateY(10px);
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #fff;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            z-index: 9999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease;
            border: 1px solid rgba(255,255,255,0.15);
        `;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 1200);
    }

    _createSwipeIndicator() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed;
            top: 50%;
            bottom: auto;
            width: 48px;
            height: 80px;
            transform: translateY(-50%);
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 0 12px 12px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 8888;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.1s;
        `;
        const arrow = document.createElement('span');
        arrow.className = 'swipe-arrow';
        arrow.style.cssText = 'font-size: 22px; color: rgba(255,255,255,0.8);';
        el.appendChild(arrow);
        return el;
    }

    _animatePageTransition(direction) {
        const pageContainer = document.querySelector('.page-container');
        if (!pageContainer) return;

        const translateStart = direction === 'left' ? '30px' : '-30px';
        pageContainer.style.transition = 'none';
        pageContainer.style.opacity = '0.7';
        pageContainer.style.transform = `translateX(${translateStart})`;

        requestAnimationFrame(() => {
            pageContainer.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            pageContainer.style.opacity = '1';
            pageContainer.style.transform = 'translateX(0)';
        });
    }
}

// Init
const swipeManager = new SwipeManager();
window.swipeManager = swipeManager;
