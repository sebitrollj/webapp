/**
 * ProtoMusic Desktop - Main Application
 * Navigation, rendering, and state management
 */

class ProtoMusicApp {
    constructor() {
        this.currentPage = 'home';
        this.exploreOffset = 0;
        this.exploreLimit = 24;
        this.kikisOffset = 0;
        this.kikisLimit = 30;
        this.loadedVideos = new Set();
        this.kikisLoadedVideos = new Set();
        this.videoCache = new Map(); // Cache for search fallback
        this.favorites = this.loadFavorites();
        this.playlists = this.loadPlaylists();
        this.currentPlaylistId = null; // Currently open playlist
        this._pendingPlaylistVideo = null; // Video waiting to be added to playlist
        this.contextMenu = null;
        this.contextMenuVideo = null;
        this.viewMode = localStorage.getItem('season-view-mode') || 'large'; // Grid view mode

        this.init();
    }

    async init() {
        this.initNavigation();
        this.initSearch();
        this.initMobileHeader();
        this.initSeeAllButtons();
        this.initContextMenu();
        this.initOldUISwitch();
        this.initPlaylists();
        await this.loadHomePage();
    }

    initOldUISwitch() {
        const switchBtn = document.getElementById('switchToOldUIBtn');
        const overlay = document.getElementById('uiSwitchOverlay');
        const cancelBtn = document.getElementById('uiSwitchCancel');
        const confirmBtn = document.getElementById('uiSwitchConfirm');

        if (!switchBtn || !overlay) return;

        // Open modal
        switchBtn.addEventListener('click', () => {
            overlay.style.display = 'flex';
            // Trigger animation restart
            overlay.style.animation = 'none';
            overlay.offsetHeight; // reflow
            overlay.style.animation = '';
        });

        // Close on cancel
        cancelBtn?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        // Close on overlay background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display !== 'none') {
                overlay.style.display = 'none';
            }
        });

        // Confirm: navigate to old UI
        confirmBtn?.addEventListener('click', () => {
            // Navigate to the old UI folder (nested one level inside Protomusic-mainOld)
            window.location.href = '../Protomusic-mainOld/Protomusic-main/index.html';
        });
    }

    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Handle click on icon or text
                const target = item.closest('[data-page]');
                const page = target.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Update nav active state (Sidebar + Bottom Nav)
        document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Show page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.dataset.page === page);
        });

        this.currentPage = page;

        // Clear ambient background when leaving home page
        if (page !== 'home') {
            this.clearAmbientBackground();
        }

        // Load page content
        switch (page) {
            case 'home':
                this.loadHomePage();
                break;
            case 'explore':
                this.loadExplorePage();
                break;
            case 'library':
                this.loadLibraryPage();
                break;
            case 'history':
                this.loadHistoryPage();
                break;
            case 'kikiskotheque':
                this.loadKikiskothequePage();
                break;
        }
    }

    initSearch() {
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 300);
            }
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    this.performSearch(query);
                }
            }
        });
    }

    initMobileHeader() {
        const mobileSearchToggle = document.getElementById('mobileSearchToggle');
        const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
        const searchContainer = document.getElementById('searchContainer');
        const searchInput = document.getElementById('searchInput');

        // Toggle Search
        if (mobileSearchToggle && searchContainer) {
            mobileSearchToggle.addEventListener('click', () => {
                searchContainer.classList.add('show-mobile-search');
                searchInput?.focus();
            });

            // Close search when clicking outside input (on the container background)
            searchContainer.addEventListener('click', (e) => {
                // Only close if clicking on the container itself (the overlay background), not the input 
                if (e.target === searchContainer) {
                    searchContainer.classList.remove('show-mobile-search');
                }
            });

            // GLOBAL: Close search when clicking anywhere on the page (outside container & button)
            document.addEventListener('click', (e) => {
                const isClickInside = searchContainer.contains(e.target);
                const isClickOnToggle = mobileSearchToggle.contains(e.target);

                if (!isClickInside && !isClickOnToggle && searchContainer.classList.contains('show-mobile-search')) {
                    searchContainer.classList.remove('show-mobile-search');
                }
            });
        }

        // Settings Navigation
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', () => {
                this.navigateTo('settings');
            });
        }
    }

    initSeeAllButtons() {
        const seeAllButtons = document.querySelectorAll('.see-all-btn');
        seeAllButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateTo('explore');
            });
        });
    }

    initContextMenu() {
        this.contextMenu = document.getElementById('videoContextMenu');

        // Hide context menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Global right-click handler:
        // - On a video card → show custom menu
        // - Anywhere else   → do nothing (suppress browser default)
        document.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.video-card');
            if (card) {
                // Let showContextMenu handle it (called from createVideoCard)
                return;
            }
            // Suppress default browser menu everywhere else, show nothing
            e.preventDefault();
        });

        // Handle context menu item clicks
        this.contextMenu?.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            if (this.contextMenuVideo) {
                this.handleContextMenuAction(action, this.contextMenuVideo);
            }

            this.hideContextMenu();
        });
    }

    showContextMenu(e, video) {
        e.preventDefault();

        if (!this.contextMenu) return;

        this.contextMenuVideo = video;

        // Position the menu at mouse coordinates
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.style.top = `${e.clientY}px`;
        this.contextMenu.classList.remove('hidden');

        // Update favorite menu item text
        const favoriteItem = this.contextMenu.querySelector('[data-action="toggle-favorite"] span');
        if (favoriteItem) {
            favoriteItem.textContent = this.favorites.has(video.video_id)
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris';
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
            this.contextMenuVideo = null;
        }
    }

    handleContextMenuAction(action, video) {
        switch (action) {
            case 'add-to-queue':
                if (typeof player !== 'undefined' && player.addToQueue) {
                    player.addToQueue(video);
                }
                break;

            case 'play-next':
                if (typeof player !== 'undefined' && player.addToQueueNext) {
                    player.addToQueueNext(video);
                }
                break;

            case 'toggle-favorite':
                this.toggleFavorite(video);
                if (this.currentPage === 'library') {
                    this.loadLibraryPage();
                }
                break;

            case 'add-to-playlist':
                this.showAddToPlaylistModal(video);
                break;
        }
    }

    async performSearch(query) {
        try {
            // Setup loading UI immediately
            this.navigateTo('explore');
            const grid = document.getElementById('exploreGrid');
            const sectionHeader = document.querySelector('[data-page="explore"] .section-header h2');
            const loadMoreBtn = document.getElementById('loadMoreBtn');

            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1">
                        <div class="loading-spinner" style="margin: 20px auto; width: 40px; height: 40px; border: 4px solid rgba(255,0,0,0.2); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p>Recherche en cours...</p>
                    </div>
                    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
                `;
            }
            if (sectionHeader) {
                sectionHeader.textContent = `Recherche de "${query}"...`;
            }
            if (loadMoreBtn) {
                loadMoreBtn.style.display = 'none';
            }

            let videos = [];
            const result = await api.search(query);

            if (result && result.success && result.videos && result.videos.length > 0) {
                videos = result.videos;
            } else {
                console.log('Search API returned no results, trying massive local fallback...');

                // If our cache is poor (e.g. fresh page load), let's massively populate it to ensure search works!
                if (this.videoCache.size < 100) {
                    try {
                        const bulk = await api.getPublicMedia(400, 0);
                        if (bulk && bulk.success && bulk.videos) {
                            bulk.videos.forEach(v => this.videoCache.set(v.video_id, v));
                        }
                    } catch (e) { console.warn("Extensive search preload failed", e); }
                }

                const normalizedQuery = query.toLowerCase();

                // If searching for "kiki", ensure we have kikiskotheque videos loaded
                if (normalizedQuery.includes('kiki')) {
                    try {
                        const hasKikis = Array.from(this.videoCache.values()).some(v => (v.owner_name || '').toLowerCase().includes('saison'));
                        if (!hasKikis) {
                            console.log("Fetching Kikiskotheque seasons for kiki search...");
                            const seriesReq = await api.getSeries();
                            if (seriesReq && seriesReq.success && seriesReq.series) {
                                const topSeasons = seriesReq.series.slice(0, 5); // Load top 5 seasons
                                await Promise.all(topSeasons.map(async (season) => {
                                    const epReq = await api.getEpisodes(season.series_id);
                                    if (epReq && epReq.success && epReq.episodes) {
                                        epReq.episodes.forEach(ep => {
                                            ep.season_name = season.season_name;
                                            this.videoCache.set(ep.video_id, ep);
                                        });
                                    }
                                }));
                            }
                        }
                    } catch (e) { console.warn("Kiki preload failed", e); }
                }

                videos = Array.from(this.videoCache.values()).filter(v => {
                    const title = (v.title || '').toLowerCase();
                    const artist = (v.owner_name || '').toLowerCase();
                    const season = (v.season_name || '').toLowerCase();

                    // Match against query
                    return title.includes(normalizedQuery) ||
                        artist.includes(normalizedQuery) ||
                        season.includes(normalizedQuery) ||
                        // Special check for kikiskotheque matching 
                        (normalizedQuery.includes('kiki') && artist.includes('saison'));
                });
            }

            if (videos.length > 0) {
                // Remove duplicates if any
                const uniqueVideos = Array.from(new Map(videos.map(v => [v.video_id, v])).values());

                if (grid) {
                    grid.innerHTML = '';
                    uniqueVideos.forEach(video => {
                        grid.appendChild(this.createVideoCard(video));
                    });
                }
                if (sectionHeader) {
                    sectionHeader.textContent = `Résultats pour "${query}"`;
                }
            } else {
                // Show no results message
                if (grid) {
                    grid.innerHTML = `
                        <div class="empty-state" style="grid-column: 1/-1">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                            </svg>
                            <h3>Aucun résultat</h3>
                            <p>Aucune vidéo trouvée pour "${this.escapeHtml(query)}"</p>
                        </div>
                    `;
                }
                if (sectionHeader) {
                    sectionHeader.textContent = `Résultats pour "${query}"`;
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
            // Revert loading UI to error
            const sectionHeader = document.querySelector('[data-page="explore"] .section-header h2');
            if (sectionHeader) sectionHeader.textContent = `Erreur de recherche`;
        }
    }

    async loadHomePage() {
        await Promise.all([
            this.loadFeatured(),
            this.loadQuickPicks(),
            this.loadMostViewed(),
            this.loadRandom()
        ]);
    }

    async loadFeatured() {
        try {
            const result = await api.getPublicMedia(1, 0);

            if (result.success && result.videos?.length > 0) {
                const featured = result.videos[0];
                this.renderFeatured(featured);
            }
        } catch (error) {
            console.error('Failed to load featured:', error);
        }
    }

    renderFeatured(video) {
        const featuredCard = document.getElementById('featuredCard');
        const thumbnail = featuredCard?.querySelector('.featured-thumbnail');
        const title = featuredCard?.querySelector('.featured-title');
        const subtitle = featuredCard?.querySelector('.featured-subtitle');
        const playBtn = document.getElementById('playFeaturedBtn');

        // Always use proxy for thumbnails
        const thumbnailUrl = api.getThumbnailUrl(video.video_id);
        // Determine custom thumbnail if available
        let customThumbUrl = null;
        if (video.thumbnail && video.thumbnail.trim() !== '') {
            if (video.thumbnail.startsWith('http')) {
                customThumbUrl = video.thumbnail;
            } else {
                const baseUrl = (window.api && window.api.baseUrl) || 'https://protomusic-proxy.onrender.com';
                const path = video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail;
                customThumbUrl = `${baseUrl}${path}`;
            }
        }
        const displayThumb = customThumbUrl || thumbnailUrl;

        if (thumbnail) {
            thumbnail.style.backgroundImage = `url(${displayThumb})`;
            thumbnail.classList.remove('skeleton');
            // If custom thumb fails, fallback to proxy thumb
            if (customThumbUrl) {
                const testImg = new Image();
                testImg.onerror = () => {
                    thumbnail.style.backgroundImage = `url(${thumbnailUrl})`;
                    if (window.imageRetry) imageRetry.setupBackgroundRetry(thumbnail, thumbnailUrl);
                };
                testImg.src = customThumbUrl;
            }
            // Setup retry for background image
            if (window.imageRetry) {
                imageRetry.setupBackgroundRetry(thumbnail, displayThumb);
            }
        }
        if (title) {
            title.textContent = video.title;
            title.classList.remove('skeleton-text');
        }
        if (subtitle) {
            subtitle.textContent = video.owner_name || 'Artiste';
            subtitle.classList.remove('skeleton-text');
        }

        playBtn?.addEventListener('click', () => {
            player.addAndPlay(video);
        });

        featuredCard?.addEventListener('click', (e) => {
            if (!e.target.closest('.play-featured-btn')) {
                player.addAndPlay(video);
            }
        });
    }

    isAmbientBackgroundEnabled() {
        // First check settingsManager if available
        if (window.settingsManager && settingsManager.settings) {
            return settingsManager.settings.ambientBackground === true;
        }

        // Fallback: check localStorage directly
        try {
            const settings = localStorage.getItem('protomusic_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                return parsed.ambientBackground === true;
            }
        } catch (e) {
            console.warn('Failed to read ambient background setting:', e);
        }

        return false;
    }

    async loadQuickPicks() {
        try {
            // Use timestamp-based offset to get different videos each time
            const now = Date.now();
            const offset = Math.floor((now / 1000) % 50); // Changes every second, cycles through 0-49

            // Fetch more videos from random offset
            const result = await api.getPublicMedia(20, offset);

            if (result.success && result.videos) {
                // Shuffle array using Fisher-Yates algorithm
                const shuffled = [...result.videos];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }

                // Take first 12 from shuffled array
                const randomPicks = shuffled.slice(0, 12);

                const grid = document.getElementById('quickPicksGrid');
                if (grid) {
                    grid.innerHTML = '';
                    randomPicks.forEach(video => {
                        grid.appendChild(this.createVideoCard(video));
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load quick picks:', error);
            this.showError('quickPicksGrid', 'Impossible de charger les vidéos');
        }
    }

    async loadMostViewed() {
        try {
            const result = await api.getMostViewedMedia(12, 0);

            if (result.success && result.videos) {
                const grid = document.getElementById('mostViewedGrid');
                if (grid) {
                    grid.innerHTML = '';
                    result.videos.forEach(video => {
                        grid.appendChild(this.createVideoCard(video));
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load most viewed:', error);
            this.showError('mostViewedGrid', 'Impossible de charger les vidéos');
        }
    }

    async loadRandom() {
        try {
            // Don't exclude videos for random section - we want fresh random picks each time
            const result = await api.getRandomMedia(12, []);

            if (result.success && result.videos) {
                const grid = document.getElementById('randomGrid');
                if (grid) {
                    grid.innerHTML = '';
                    result.videos.forEach(video => {
                        grid.appendChild(this.createVideoCard(video));
                    });
                }

                // Refresh button - only add listener once
                const refreshBtn = document.getElementById('refreshRandomBtn');
                if (refreshBtn && !refreshBtn.hasAttribute('data-initialized')) {
                    refreshBtn.setAttribute('data-initialized', 'true');
                    refreshBtn.addEventListener('click', () => this.loadRandom());
                }
            }
        } catch (error) {
            console.error('Failed to load random:', error);
            this.showError('randomGrid', 'Impossible de charger les vidéos');
        }
    }

    async loadExplorePage() {
        const grid = document.getElementById('exploreGrid');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        if (!grid) return;

        // Reset if coming back to page
        if (this.exploreOffset === 0) {
            grid.innerHTML = '';
        }

        try {
            const result = await api.getPublicMedia(this.exploreLimit, this.exploreOffset);

            if (result.success && result.videos) {
                result.videos.forEach(video => {
                    if (!this.loadedVideos.has(video.video_id)) {
                        grid.appendChild(this.createVideoCard(video));
                        this.loadedVideos.add(video.video_id);
                    }
                });

                this.exploreOffset += this.exploreLimit;

                // Setup load more button
                if (!loadMoreBtn.hasAttribute('data-initialized')) {
                    loadMoreBtn.setAttribute('data-initialized', 'true');
                    loadMoreBtn.addEventListener('click', () => this.loadMoreExplore());
                }

                // Hide button if no more videos
                if (result.videos.length < this.exploreLimit) {
                    loadMoreBtn.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to load explore:', error);
        }
    }

    async loadMoreExplore() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Chargement...';
        }

        await this.loadExplorePage();

        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Charger plus';
        }
    }

    async loadLibraryPage() {
        const grid = document.getElementById('libraryGrid');
        const emptyState = document.getElementById('libraryEmptyState');
        const countEl = document.getElementById('favoritesCount');

        if (!grid) return;

        // Get ALL favorites from Map (already contains full video objects)
        const favoriteVideos = Array.from(this.favorites.values());

        grid.innerHTML = '';

        if (favoriteVideos.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = '';
            if (countEl) countEl.textContent = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        grid.style.display = 'grid';
        if (countEl) countEl.textContent = `${favoriteVideos.length} favori${favoriteVideos.length > 1 ? 's' : ''}`;

        // Render each favorite video card
        favoriteVideos.forEach(video => {
            grid.appendChild(this.createVideoCard(video));
        });
    }

    loadHistoryPage() {
        const history = this.getHistory();
        const grid = document.getElementById('historyList');

        if (grid) {
            if (history.length > 0) {
                grid.innerHTML = '';
                history.forEach(video => {
                    grid.appendChild(this.createVideoCard(video));
                });
            } else {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                        </svg>
                        <h3>Aucun historique</h3>
                        <p>Les vidéos regardées apparaîtront ici</p>
                    </div>
                `;
            }
        }
    }

    async loadKikiskothequePage() {
        const grid = document.getElementById('kikiskothequeGrid');
        const loadMoreBtn = document.getElementById('loadMoreKikisBtn');

        if (!grid) return;

        // Hide load more button - seasons don't need pagination
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';

        // Show loading state
        grid.innerHTML = '<div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-tertiary);">Chargement des saisons...</div>';

        try {
            const result = await api.getSeries();

            if (result.success && result.series && result.series.length > 0) {
                grid.innerHTML = '';

                // Kalandar elements
                const kalandarGrid = document.getElementById('kalandarGrid');
                const kalandarHeader = document.getElementById('kalandarHeader');
                if (kalandarGrid) kalandarGrid.innerHTML = '';
                let hasKalandar = false;

                // Sort seasons in descending order (latest first)
                const sortedSeries = result.series.sort((a, b) => {
                    const numA = parseInt(a.season_name.match(/\d+/)) || 0;
                    const numB = parseInt(b.season_name.match(/\d+/)) || 0;
                    return numB - numA;
                });

                sortedSeries.forEach(season => {
                    const card = this.createSeasonCard(season);

                    // Check if it's Kalandar
                    if (season.series_id === 'kalandar' || season.season_name.toLowerCase().includes('kalandar')) {
                        if (kalandarGrid) {
                            kalandarGrid.appendChild(card);
                            hasKalandar = true;
                        } else {
                            grid.appendChild(card); // Fallback
                        }
                    } else {
                        grid.appendChild(card);
                    }
                });

                // Toggle Kalandar header and grid
                if (kalandarHeader) {
                    kalandarHeader.style.display = hasKalandar ? 'block' : 'none';
                }
                if (kalandarGrid) {
                    // Reset display to grid (or whatever CSS defines) if we have items
                    // otherwise hide it
                    kalandarGrid.style.display = hasKalandar ? '' : 'none';
                    if (hasKalandar && getComputedStyle(kalandarGrid).display === 'none') {
                        // Fallback if class doesn't apply for some reason, though it should.
                        // But since we set it to 'none' in loadSeasonEpisodes which is inline style,
                        // setting it to '' should revert to CSS class 'display: grid'.
                        // Let's force it just in case inline style persists.
                        kalandarGrid.style.removeProperty('display');
                    }
                }
            } else {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                        <h3>Aucune saison disponible</h3>
                        <p>La Kikiskothèque est vide pour le moment</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load kikiskotheque:', error);
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1">
                    <h3>Erreur de chargement</h3>
                    <p>Impossible de charger les saisons</p>
                </div>
            `;
        }
    }

    createSeasonCard(season) {
        const card = document.createElement('div');
        const episodeCount = season.episode_count || 0;

        // Special Unique UI for Kalandar
        if (season.series_id === 'kalandar' || (season.season_name && season.season_name.toLowerCase().includes('kalandar'))) {
            card.className = 'season-card kalandar-banner';
            card.dataset.seasonId = season.series_id;

            card.innerHTML = `
                <div class="kalandar-animated-bg"></div>
                <div class="kalandar-stars"></div>
                <div class="kalandar-content">
                    <div class="kalandar-text">
                        <span class="kalandar-badge">Édition Spéciale</span>
                        <h3 class="kalandar-title">Kalendar 2025</h3>
                        <p class="kalandar-desc">Débloquez une nouvelle surprise musicale chaque jour.</p>
                        <div class="kalandar-stats">
                            <span class="season-count">${episodeCount} épisode${episodeCount !== 1 ? 's' : ''} disponibles</span>
                        </div>
                    </div>
                    <div class="kalandar-action">
                        <button class="kalandar-play-btn">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Standard Premium Season Card
            card.className = 'season-card';
            card.dataset.seasonId = season.series_id;

            card.innerHTML = `
                <div class="season-card-bg"></div>
                <div class="season-content-wrapper">
                    <div class="season-thumbnail">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                        <div class="season-play-overlay">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="season-info">
                        <h3 class="season-title">${this.escapeHtml(season.season_name || season.title || 'Saison')}</h3>
                        <div class="season-badge">
                            <span class="season-count">${episodeCount} épisode${episodeCount !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div class="season-action">
                        <button class="play-circle-btn">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }

        // Click to load episodes
        card.addEventListener('click', () => {
            this.loadSeasonEpisodes(season);
        });

        return card;
    }

    async loadSeasonEpisodes(season) {
        const grid = document.getElementById('kikiskothequeGrid');
        const kalandarHeader = document.getElementById('kalandarHeader');
        const kalandarGrid = document.getElementById('kalandarGrid');

        if (!grid) return;

        // Hide Kalandar section while viewing episodes
        if (kalandarHeader) kalandarHeader.style.display = 'none';
        if (kalandarGrid) kalandarGrid.style.display = 'none';

        // Show loading
        grid.innerHTML = '<div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-tertiary);">Chargement des épisodes...</div>';

        // Update header to show we're in a season
        const sectionHeader = document.querySelector('[data-page="kikiskotheque"] .section-header h2');
        if (sectionHeader) {
            sectionHeader.innerHTML = `<button class="back-btn" id="backToSeasons">←</button> ${this.escapeHtml(season.season_name || 'Saison')}`;

            // Add back button handler
            setTimeout(() => {
                document.getElementById('backToSeasons')?.addEventListener('click', () => {
                    sectionHeader.textContent = '🎵 Kikiskothèque';
                    this.loadKikiskothequePage();
                });
            }, 0);
        }

        try {
            const result = await api.getEpisodes(season.series_id);

            if (result.success && result.episodes && result.episodes.length > 0) {
                grid.innerHTML = '';
                result.episodes.forEach(episode => {
                    // Convert episode to video format
                    const video = {
                        video_id: episode.video_id || episode.id,
                        title: episode.title,
                        owner_name: episode.owner_name || season.season_name,
                        thumbnail: episode.thumbnail,
                        duration: episode.duration
                    };
                    grid.appendChild(this.createVideoCard(video));
                });
            } else {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                        <h3>Aucun épisode</h3>
                        <p>Cette saison ne contient pas encore d'épisodes</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load episodes:', error);
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1">
                    <h3>Erreur de chargement</h3>
                    <p>Impossible de charger les épisodes</p>
                </div>
            `;
        }
    }

    createVideoCard(video, style = 'grid') {
        // Cache video for search fallback
        if (video && video.video_id) {
            this.videoCache.set(video.video_id, video);
        }
        const card = document.createElement('div');
        card.className = style === 'list' ? 'list-video-card' : 'video-card';
        card.dataset.videoId = video.video_id;

        const isFavorite = this.favorites.has(video.video_id);
        const duration = video.duration || '0:00';
        const views = video.views ? `${video.views} vues` : '';

        // Determine thumbnail URL: Prefer manual/API provided thumbnail, fallback to auto
        let thumbnailUrl;
        if (video.thumbnail && video.thumbnail.trim() !== '') {
            if (video.thumbnail.startsWith('http')) {
                thumbnailUrl = video.thumbnail;
            } else {
                // Prepend base URL for relative paths via public API access
                const baseUrl = (window.api && window.api.baseUrl) || 'https://protomusic-proxy.onrender.com';
                const path = video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail;
                thumbnailUrl = `${baseUrl}${path}`;
            }
        } else {
            // Fallback to proxy generated thumbnail
            thumbnailUrl = api.getThumbnailUrl(video.video_id);
        }

        card.innerHTML = `
            <div class="video-thumbnail">
                <img src="${thumbnailUrl}" alt="" loading="lazy"
                    data-fallback-url="${api.getThumbnailUrl(video.video_id)}"
                    data-original-url="${thumbnailUrl}"
                    onerror="
                        const fb = this.getAttribute('data-fallback-url');
                        const orig = this.getAttribute('data-original-url');
                        if (fb && this.src !== fb) {
                            this.src = fb;
                        } else {
                            this.onerror=null;
                            this.style.display='none';
                            this.parentElement.style.background='linear-gradient(135deg,#1a1a2e,#16213e)';
                        }
                    ">
                <div class="video-duration">${duration}</div>
                <div class="video-play-overlay">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>
            <div class="video-info">
                <h3 class="video-title">${this.escapeHtml(video.title)}</h3>
                <span class="video-artist">${this.escapeHtml(video.owner_name || 'Inconnu')}</span>
                ${views ? `<span class="video-views">${views}</span>` : ''}
            </div>
            <button class="favorite-btn ${isFavorite ? 'active' : ''}" title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                <svg viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </button>
        `;

        // Favorite button
        const favoriteBtn = card.querySelector('.favorite-btn');
        favoriteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(video);

            // Update UI immediately
            const isNowFavorite = this.favorites.has(video.video_id);
            favoriteBtn.classList.toggle('active', isNowFavorite);
            favoriteBtn.title = isNowFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
            const svg = favoriteBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', isNowFavorite ? 'currentColor' : 'none');
            }
            // Update full player if this video is currently playing
            if (player.currentVideo && player.currentVideo.video_id === video.video_id) {
                player.updateFullPlayerFavoriteUI();
            }
            // Live-refresh library page if open
            if (this.currentPage === 'library') {
                this.loadLibraryPage();
            }
        });

        // Click to play
        card.addEventListener('click', async (e) => {
            // Don't play if clicking favorite button
            if (e.target.closest('.favorite-btn')) {
                return;
            }

            // Check if we're in Kikiskothèque page
            if (this.currentPage === 'kikiskotheque') {
                // Start playing immediately to avoid delay
                player.addAndPlay(video);
                this.addToHistory(video);

                // Load full queue in background (async, non-blocking)
                this.getAllKikiskothekVideos().then(allVideos => {
                    if (allVideos.length > 0) {
                        // Find the clicked video index
                        const startIndex = allVideos.findIndex(v => v.video_id === video.video_id);
                        if (startIndex !== -1) {
                            // Reorder to start with clicked video
                            const reordered = [
                                ...allVideos.slice(startIndex),
                                ...allVideos.slice(0, startIndex)
                            ];
                            player.queue = reordered;
                            player.queueIndex = 0;
                        } else {
                            player.queue = [video, ...allVideos];
                            player.queueIndex = 0;
                        }
                        // Update queue UI
                        player.renderQueue();
                    }
                }).catch(error => {
                    console.error('Failed to load Kikiskothèque queue:', error);
                });
            } else {
                // For other pages: get all visible videos and build queue
                const currentPageElement = document.querySelector(`.page[data-page="${this.currentPage}"].active`);
                const allCards = currentPageElement ? currentPageElement.querySelectorAll('.video-card') : [];

                const allVideos = [];
                allCards.forEach(card => {
                    const videoId = card.dataset.videoId;
                    if (videoId) {
                        // Try to extract video data from the card
                        const title = card.querySelector('.video-title')?.textContent || '';
                        const artist = card.querySelector('.video-artist')?.textContent || '';
                        const thumbnail = card.querySelector('.video-thumbnail img')?.src || '';
                        const duration = card.querySelector('.video-duration')?.textContent || '0:00';

                        allVideos.push({
                            video_id: videoId,
                            title: title,
                            owner_name: artist,
                            thumbnail: thumbnail,
                            duration: duration
                        });
                    }
                });

                // Find clicked video index
                const clickedIndex = allVideos.findIndex(v => v.video_id === video.video_id);

                if (clickedIndex !== -1 && allVideos.length > 1) {
                    // Reorder queue to start with clicked video
                    const queuedVideos = [
                        ...allVideos.slice(clickedIndex),
                        ...allVideos.slice(0, clickedIndex)
                    ];

                    player.queue = queuedVideos;
                    player.queueIndex = 0;
                    player.playVideo(video);
                    player.renderQueue();
                } else {
                    // Fallback: just play single video
                    player.addAndPlay(video);
                }

                this.addToHistory(video);
            }
        });

        // Right-click context menu
        card.addEventListener('contextmenu', (e) => {
            this.showContextMenu(e, video);
        });

        // Setup image retry for thumbnail
        const img = card.querySelector('.video-thumbnail img');
        if (img && window.imageRetry) {
            imageRetry.setupRetry(img, thumbnailUrl);
        }

        return card;
    }

    async getAllKikiskothekVideos() {
        try {
            // Get all seasons
            const seriesResult = await api.getSeries();
            if (!seriesResult.success || !seriesResult.series) {
                return [];
            }

            const allVideos = [];

            // Fetch episodes from all seasons
            for (const season of seriesResult.series) {
                const episodesResult = await api.getEpisodes(season.series_id);
                if (episodesResult.success && episodesResult.episodes) {
                    episodesResult.episodes.forEach(episode => {
                        allVideos.push({
                            video_id: episode.video_id || episode.id,
                            title: episode.title,
                            owner_name: episode.owner_name || season.season_name,
                            thumbnail: episode.thumbnail,
                            duration: episode.duration
                        });
                    });
                }
            }

            // Fisher-Yates shuffle
            for (let i = allVideos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
            }

            // Apply queue size limit from settings
            const queueLimit = window.settingsManager ? settingsManager.settings.maxQueueSize : 50;
            return allVideos.slice(0, queueLimit);
        } catch (error) {
            console.error('Failed to load all Kikiskothek videos:', error);
            return [];
        }
    }

    async reloadKikiskothekQueue() {
        if (this.currentPage !== 'kikiskotheque' || !player.currentVideo) return;

        const allVideos = await this.getAllKikiskothekVideos();
        if (allVideos.length > 0) {
            // Keep current video, replace rest of queue
            const newQueue = [player.currentVideo, ...allVideos.filter(v => v.video_id !== player.currentVideo.video_id)];
            player.queue = newQueue;
            player.queueIndex = 0;
            player.renderQueue();
        }
    }

    // Favorites Management
    loadFavorites() {
        try {
            const saved = localStorage.getItem('protomusic_favorites');
            if (!saved) return new Map();

            const parsed = JSON.parse(saved);
            // Support both old format (array of IDs) and new format (array of [id, object] pairs)
            if (Array.isArray(parsed) && parsed.length > 0) {
                if (typeof parsed[0] === 'string') {
                    // Old format - just IDs, migrate to empty Map (user will re-favorite)
                    console.log('Migrating favorites from old format');
                    return new Map();
                }
                // New format - array of [key, value] pairs
                return new Map(parsed);
            }
            return new Map();
        } catch {
            return new Map();
        }
    }

    saveFavorites() {
        try {
            // Convert Map to array of [key, value] pairs for JSON storage
            localStorage.setItem('protomusic_favorites', JSON.stringify([...this.favorites]));
        } catch (error) {
            console.error('Failed to save favorites:', error);
        }
    }

    toggleFavorite(video) {
        if (this.favorites.has(video.video_id)) {
            this.favorites.delete(video.video_id);
        } else {
            // Store complete video object, not just ID
            this.favorites.set(video.video_id, video);
        }
        this.saveFavorites();
    }

    showError(gridId, message) {
        const grid = document.getElementById(gridId);
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1">
                    <p>${message}</p>
                </div>
            `;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Local Storage helpers
    getLikedVideos() {
        try {
            return JSON.parse(localStorage.getItem('protomusic_liked') || '[]');
        } catch {
            return [];
        }
    }

    saveLikedVideos(videos) {
        localStorage.setItem('protomusic_liked', JSON.stringify(videos));
    }

    toggleLike(video) {
        const liked = this.getLikedVideos();
        const index = liked.findIndex(v => v.video_id === video.video_id);

        if (index !== -1) {
            liked.splice(index, 1);
        } else {
            liked.unshift(video);
        }

        this.saveLikedVideos(liked);
        return index === -1; // Returns true if now liked
    }

    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('protomusic_history') || '[]');
        } catch {
            return [];
        }
    }

    addToHistory(video) {
        const history = this.getHistory();

        // Remove if already exists
        const index = history.findIndex(v => v.video_id === video.video_id);
        if (index !== -1) {
            history.splice(index, 1);
        }

        // Add to front
        history.unshift({
            ...video,
            watchedAt: Date.now()
        });

        // Keep only last 100
        if (history.length > 100) {
            history.pop();
        }

        localStorage.setItem('protomusic_history', JSON.stringify(history));
    }

    // Ambient Background
    async applyAmbientBackgroundFromImage(imageUrl) {
        console.log('🎨 Ambient Background: Starting extraction for', imageUrl);
        try {
            const color = await extractDominantColor(imageUrl);
            console.log('🎨 Ambient Background: Extracted color', color);
            this.applyAmbientBackground(color);
        } catch (error) {
            console.warn('Failed to extract dominant color:', error);
        }
    }

    applyAmbientBackground(color) {
        const { r, g, b } = color;
        console.log('🎨 Applying gradient with color:', `rgb(${r}, ${g}, ${b})`);

        // Only apply on home page
        if (this.currentPage !== 'home') {
            console.log('🎨 Not on home page, skipping ambient background');
            return;
        }

        // Create dynamic animated gradient
        const gradient = `
            radial-gradient(
                ellipse at 50% 0%,
                rgba(${r}, ${g}, ${b}, 0.4) 0%,
                rgba(${r}, ${g}, ${b}, 0.25) 30%,
                rgba(${r}, ${g}, ${b}, 0.12) 50%,
                rgba(15, 15, 15, 1) 80%
            )
        `;

        const pageContainer = document.querySelector('.page-container');
        console.log('🎨 Page container found:', !!pageContainer);
        if (pageContainer) {
            pageContainer.style.background = gradient;
            pageContainer.style.backgroundColor = '#0F0F0F';
            pageContainer.style.transition = 'background 2s cubic-bezier(0.4, 0, 0.2, 1)';
            pageContainer.style.animation = 'ambientPulse 8s ease-in-out infinite';
            console.log('🎨 Background applied successfully!');

            // Add CSS animation if not already present
            if (!document.getElementById('ambientAnimation')) {
                const style = document.createElement('style');
                style.id = 'ambientAnimation';
                style.textContent = `
                    @keyframes ambientPulse {
                        0%, 100% {
                            filter: brightness(1) saturate(1);
                        }
                        50% {
                            filter: brightness(1.1) saturate(1.15);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            console.warn('🎨 .page-container not found!');
        }
    }

    clearAmbientBackground() {
        const pageContainer = document.querySelector('.page-container');
        if (pageContainer) {
            pageContainer.style.background = '';
            pageContainer.style.backgroundColor = '';
            pageContainer.style.animation = '';
            pageContainer.style.filter = '';
        }
    }

    /**
     * Toggle grid view mode between large and compact
     */
    toggleViewMode() {
        this.viewMode = this.viewMode === 'large' ? 'compact' : 'large';
        localStorage.setItem('season-view-mode', this.viewMode);

        // Apply to all video grids on current page
        const grids = document.querySelectorAll('.video-grid');
        grids.forEach(grid => {
            grid.classList.remove('large', 'compact');
            grid.classList.add(this.viewMode);
        });

        // Update toggle button icon
        this.updateViewButtonIcon();
    }

    /**
     * Update view toggle button icon
     */
    updateViewButtonIcon() {
        const btn = document.querySelector('.view-toggle-btn');
        if (!btn) return;

        if (this.viewMode === 'compact') {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v4H3V5m0 6h18v4H3v-4m0 6h18v4H3v-4z"/></svg>`;
            btn.title = 'Vue large';
        } else {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3m10 0h8v8h-8V3M3 13h8v8H3v-8m10 0h8v8h-8v-8z"/></svg>`;
            btn.title = 'Vue compacte';
        }
    }

    // ========================
    // PLAYLISTS
    // ========================

    loadPlaylists() {
        try {
            return JSON.parse(localStorage.getItem('protomusic_playlists') || '[]');
        } catch {
            return [];
        }
    }

    savePlaylists() {
        try {
            localStorage.setItem('protomusic_playlists', JSON.stringify(this.playlists));
        } catch (e) {
            console.error('Failed to save playlists:', e);
        }
    }

    initPlaylists() {
        // Library tab switching
        const tabs = document.querySelectorAll('.library-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.tab;
                document.getElementById('tabFavorites').style.display = which === 'favorites' ? '' : 'none';
                document.getElementById('tabPlaylists').style.display = which === 'playlists' ? '' : 'none';
                if (which === 'playlists') this.renderPlaylistsGrid();
            });
        });

        // Create playlist button (header)
        document.getElementById('createPlaylistBtn')?.addEventListener('click', () => {
            this.showCreatePlaylistModal(null);
        });

        // Back from detail
        document.getElementById('playlistBackBtn')?.addEventListener('click', () => {
            this.currentPlaylistId = null;
            document.getElementById('playlistDetail').style.display = 'none';
            document.getElementById('playlistsGrid').style.display = '';
            const emptyState = document.getElementById('playlistsEmptyState');
            if (emptyState) emptyState.style.display = this.playlists.length === 0 ? '' : 'none';
        });

        // Delete playlist
        document.getElementById('playlistDeleteBtn')?.addEventListener('click', () => {
            if (!this.currentPlaylistId) return;
            const pl = this.playlists.find(p => p.id === this.currentPlaylistId);
            if (pl && confirm(`Supprimer la playlist "${pl.name}" ?`)) {
                this.deletePlaylist(this.currentPlaylistId);
                document.getElementById('playlistBackBtn').click();
            }
        });

        // Create playlist modal
        const createOverlay = document.getElementById('createPlaylistOverlay');
        document.getElementById('createPlaylistCancel')?.addEventListener('click', () => {
            createOverlay.style.display = 'none';
            this._pendingPlaylistVideo = null;
        });
        createOverlay?.addEventListener('click', e => { if (e.target === createOverlay) { createOverlay.style.display = 'none'; this._pendingPlaylistVideo = null; } });
        document.getElementById('createPlaylistConfirm')?.addEventListener('click', () => {
            const input = document.getElementById('playlistNameInput');
            const name = input.value.trim();
            if (!name) { input.focus(); return; }
            const pl = this.createPlaylist(name);
            if (this._pendingPlaylistVideo) {
                this.addVideoToPlaylist(pl.id, this._pendingPlaylistVideo);
                this._pendingPlaylistVideo = null;
            }
            input.value = '';
            createOverlay.style.display = 'none';
            // Switch to playlists tab
            const plTab = document.querySelector('.library-tab[data-tab="playlists"]');
            if (plTab) plTab.click();
        });
        document.getElementById('playlistNameInput')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('createPlaylistConfirm').click();
        });

        // Add-to-playlist modal
        const addOverlay = document.getElementById('addToPlaylistOverlay');
        document.getElementById('addToPlaylistCancel')?.addEventListener('click', () => {
            addOverlay.style.display = 'none';
            this._pendingPlaylistVideo = null;
        });
        addOverlay?.addEventListener('click', e => { if (e.target === addOverlay) { addOverlay.style.display = 'none'; this._pendingPlaylistVideo = null; } });
        document.getElementById('addToPlaylistNew')?.addEventListener('click', () => {
            addOverlay.style.display = 'none';
            this.showCreatePlaylistModal(this._pendingPlaylistVideo);
        });

        // Update counts initially
        this.updateLibraryCounts();
    }

    updateLibraryCounts() {
        const favCount = document.getElementById('favoritesCount');
        const plCount = document.getElementById('playlistsCount');
        if (favCount) favCount.textContent = this.favorites.size > 0 ? `(${this.favorites.size})` : '';
        if (plCount) plCount.textContent = this.playlists.length > 0 ? `(${this.playlists.length})` : '';
    }

    createPlaylist(name) {
        const pl = { id: `pl_${Date.now()}`, name, createdAt: Date.now(), videos: [] };
        this.playlists.unshift(pl);
        this.savePlaylists();
        this.updateLibraryCounts();
        this.renderPlaylistsGrid();
        return pl;
    }

    deletePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        this.savePlaylists();
        this.updateLibraryCounts();
        this.renderPlaylistsGrid();
    }

    addVideoToPlaylist(playlistId, video) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (!pl) return;
        if (pl.videos.some(v => v.video_id === video.video_id)) return; // already there
        pl.videos.unshift(video);
        this.savePlaylists();
        // Refresh detail if open
        if (this.currentPlaylistId === playlistId) this.openPlaylistDetail(playlistId);
    }

    removeVideoFromPlaylist(playlistId, videoId) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (!pl) return;
        pl.videos = pl.videos.filter(v => v.video_id !== videoId);
        this.savePlaylists();
        if (this.currentPlaylistId === playlistId) this.openPlaylistDetail(playlistId);
    }

    renderPlaylistsGrid() {
        const grid = document.getElementById('playlistsGrid');
        const empty = document.getElementById('playlistsEmptyState');
        if (!grid) return;

        grid.innerHTML = '';

        if (this.playlists.length === 0) {
            if (empty) empty.style.display = '';
            grid.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';
        grid.style.display = 'grid';

        this.playlists.forEach(pl => {
            const card = document.createElement('div');
            card.className = 'playlist-card';

            // Cover: up to 4 thumbnails in a mosaic
            const thumbs = pl.videos.slice(0, 4).map(v =>
                `<img src="${v.thumbnail_url || ''}" alt="" onerror="this.style.display='none'">`
            );
            while (thumbs.length < 4) thumbs.push(`<div class="playlist-cover-empty"></div>`);

            card.innerHTML = `
                <div class="playlist-cover ${pl.videos.length === 0 ? 'empty' : ''}">
                    ${pl.videos.length > 0 ? thumbs.join('') : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>`}
                </div>
                <div class="playlist-card-info">
                    <span class="playlist-card-name">${this.escapeHtml(pl.name)}</span>
                    <span class="playlist-card-count">${pl.videos.length} vidéo${pl.videos.length !== 1 ? 's' : ''}</span>
                </div>
            `;

            card.addEventListener('click', () => this.openPlaylistDetail(pl.id));
            grid.appendChild(card);
        });
    }

    openPlaylistDetail(playlistId) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (!pl) return;

        this.currentPlaylistId = playlistId;

        // Update detail header
        document.getElementById('playlistDetailName').textContent = pl.name;
        document.getElementById('playlistDetailCount').textContent = `${pl.videos.length} vidéo${pl.videos.length !== 1 ? 's' : ''}`;

        // Show/hide detail vs grid
        document.getElementById('playlistsGrid').style.display = 'none';
        const emptyState = document.getElementById('playlistsEmptyState');
        if (emptyState) emptyState.style.display = 'none';
        document.getElementById('playlistDetail').style.display = '';

        // Render videos
        const grid = document.getElementById('playlistDetailGrid');
        const detailed = document.getElementById('playlistDetailEmpty');
        grid.innerHTML = '';

        if (pl.videos.length === 0) {
            if (detailed) detailed.style.display = '';
            grid.style.display = 'none';
            return;
        }

        if (detailed) detailed.style.display = 'none';
        grid.style.display = 'grid';

        pl.videos.forEach(video => {
            const card = this.createVideoCard(video);
            // Add remove button on playlist cards
            const removeBtn = document.createElement('button');
            removeBtn.className = 'playlist-remove-btn';
            removeBtn.title = 'Retirer de la playlist';
            removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
            removeBtn.addEventListener('click', e => {
                e.stopPropagation();
                this.removeVideoFromPlaylist(playlistId, video.video_id);
            });
            card.style.position = 'relative';
            card.appendChild(removeBtn);
            grid.appendChild(card);
        });
    }

    showAddToPlaylistModal(video) {
        this._pendingPlaylistVideo = video;
        const overlay = document.getElementById('addToPlaylistOverlay');
        const list = document.getElementById('playlistPickerList');
        if (!overlay || !list) return;

        list.innerHTML = '';

        if (this.playlists.length === 0) {
            list.innerHTML = `<p class="playlist-picker-empty">Aucune playlist. Crée-en une d'abord.</p>`;
        } else {
            this.playlists.forEach(pl => {
                const already = pl.videos.some(v => v.video_id === video.video_id);
                const item = document.createElement('button');
                item.className = `playlist-picker-item${already ? ' already-added' : ''}`;
                item.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
                    <span>${this.escapeHtml(pl.name)}</span>
                    <span class="picker-count">${pl.videos.length} vidéo${pl.videos.length !== 1 ? 's' : ''}</span>
                    ${already ? '<span class="picker-badge">✓ Ajouté</span>' : ''}
                `;
                if (!already) {
                    item.addEventListener('click', () => {
                        this.addVideoToPlaylist(pl.id, video);
                        overlay.style.display = 'none';
                        this._pendingPlaylistVideo = null;
                    });
                }
                list.appendChild(item);
            });
        }

        overlay.style.display = 'flex';
    }

    showCreatePlaylistModal(video) {
        this._pendingPlaylistVideo = video;
        const overlay = document.getElementById('createPlaylistOverlay');
        const input = document.getElementById('playlistNameInput');
        if (!overlay) return;
        if (input) { input.value = ''; }
        overlay.style.display = 'flex';
        setTimeout(() => input?.focus(), 100);
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProtoMusicApp();
});
