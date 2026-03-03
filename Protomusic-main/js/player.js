/**
 * ProtoMusic Player
 * Audio/Video player with HLS support
 */

class ProtoMusicPlayer {
    constructor() {
        this.video = document.getElementById('videoPlayer');
        this.hls = null;
        this.isPlaying = false;
        this.currentVideo = null;
        this.queue = [];
        this.queueIndex = 0;
        this.volume = this.loadVolume();
        this.isShuffle = false;
        this.repeatMode = 'none'; // none, one, all

        // Bass Booster (Web Audio API)
        this.audioContext = null;
        this.bassFilter = null;
        this.bassGain = 0;

        // Discord Rich Presence (will be initialized in main process)
        this.discordEnabled = localStorage.getItem('protomusic_discord_rpc') !== 'false';

        // Floating Mini Player


        this.initElements();
        this.initEvents();
        this.initVolume();
        this.initBassBooster();
        this.hidePlayerIfEmpty();
    }

    initElements() {
        // Mini Player Elements
        this.miniProgressBar = document.getElementById('miniProgressBar');
        this.miniThumbnail = document.getElementById('miniThumbnailImg');
        this.miniTitle = document.getElementById('miniTitle');
        this.miniArtist = document.getElementById('miniArtist');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.volumeSlider = document.getElementById('volumeSlider');

        // Buttons
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeBtn = document.getElementById('volumeBtn');
        this.expandPlayerBtn = document.getElementById('expandPlayerBtn');

        // Full Player Elements
        this.fullPlayerOverlay = document.getElementById('fullPlayerOverlay');
        this.closePlayerBtn = document.getElementById('closePlayerBtn');
        this.fullPlayPauseBtn = document.getElementById('fullPlayPauseBtn');
        this.fullPrevBtn = document.getElementById('fullPrevBtn');
        this.fullNextBtn = document.getElementById('fullNextBtn');
        this.progressSlider = document.getElementById('progressSlider');
        this.fullTitle = document.getElementById('fullTitle');
        this.fullArtist = document.getElementById('fullArtist');
        this.fullCurrentTime = document.getElementById('fullCurrentTime');
        this.fullDuration = document.getElementById('fullDuration');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');

        // Queue Panel Elements
        this.queuePanel = document.getElementById('queuePanel');
        this.queueBtn = document.getElementById('queueBtn');
        this.fullQueueBtn = document.getElementById('fullQueueBtn'); // Fullscreen player queue button
        this.closeQueueBtn = document.getElementById('closeQueueBtn');
        this.queueCurrentItem = document.getElementById('queueCurrentItem');
        this.queueList = document.getElementById('queueList');
        this.queueEmpty = document.getElementById('queueEmpty');

        // Full Player Favorites Button
        this.fullFavoriteBtn = document.getElementById('fullFavoriteBtn');
        this.fullFavoriteText = document.getElementById('fullFavoriteText');

        // Mini Player Favorite Button
        this.miniFavoriteBtn = document.getElementById('miniFavoriteBtn');

        // Reload Queue Button
        this.reloadQueueBtn = document.getElementById('reloadQueueBtn');
    }

    initEvents() {
        // Expand mini player on click (Mobile behavior)
        const miniPlayer = document.getElementById('miniPlayer');
        if (miniPlayer) {
            miniPlayer.addEventListener('click', (e) => {
                // Ignore if clicked on a button
                if (e.target.closest('button') || e.target.closest('input')) return;
                this.showFullPlayer();
            });
        }

        // Video events
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
        this.video.addEventListener('ended', () => this.onEnded());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('waiting', () => this.showLoading());
        this.video.addEventListener('canplay', () => this.hideLoading());

        // Play/Pause buttons
        this.playPauseBtn?.addEventListener('click', () => this.togglePlay());
        this.fullPlayPauseBtn?.addEventListener('click', () => this.togglePlay());

        // Next/Prev buttons
        this.prevBtn?.addEventListener('click', () => this.previous());
        this.nextBtn?.addEventListener('click', () => this.next());
        this.fullPrevBtn?.addEventListener('click', () => this.previous());
        this.fullNextBtn?.addEventListener('click', () => this.next());

        // Volume
        this.volumeSlider?.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        this.volumeBtn?.addEventListener('click', () => this.toggleMute());

        // Progress slider
        this.progressSlider?.addEventListener('input', (e) => {
            const time = (e.target.value / 100) * this.video.duration;
            this.video.currentTime = time;
        });

        // Expand/Close full player
        this.expandPlayerBtn?.addEventListener('click', () => this.showFullPlayer());
        this.closePlayerBtn?.addEventListener('click', () => this.hideFullPlayer());

        // Shuffle and repeat
        this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn?.addEventListener('click', () => this.toggleRepeat());

        // Queue panel
        this.queueBtn?.addEventListener('click', () => this.toggleQueuePanel());
        this.fullQueueBtn?.addEventListener('click', () => this.toggleQueuePanel()); // Fullscreen queue button
        this.closeQueueBtn?.addEventListener('click', () => this.hideQueuePanel());

        // Full Player Favorites Button
        this.fullFavoriteBtn?.addEventListener('click', () => this.toggleFullPlayerFavorite());

        // Mini Player Favorite Button
        this.miniFavoriteBtn?.addEventListener('click', () => this.toggleMiniFavorite());

        // Mini Player - Tap to open fullscreen (mobile)
        this.miniPlayer?.addEventListener('click', (e) => {
            // Don't open fullscreen if clicking on controls
            if (e.target.closest('.mini-controls') || e.target.closest('.mini-like-btn')) {
                return;
            }
            this.openFullPlayer();
        });

        // Reload Queue Button
        this.reloadQueueBtn?.addEventListener('click', () => this.reloadQueue());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Media Session API
        this.initMediaSession();

        // IPC listener for controls from mini player (Electron)
        if (window.electronAPI && window.electronAPI.onPlayerControl) {
            window.electronAPI.onPlayerControl((action) => {
                console.log('🎵 Received player control from mini player:', action);

                if (action === 'next') {
                    this.next();
                } else if (action === 'previous') {
                    this.previous();
                } else if (action.action === 'expand') {
                    // Handle expand request
                    this.video.currentTime = action.currentTime || 0;
                    this.showFullPlayer();
                }
            });
        }
    }

    initVolume() {
        this.video.volume = this.volume;
        if (this.volumeSlider) {
            this.volumeSlider.value = this.volume * 100;
        }
        this.updateVolumeIcon();
    }

    initBassBooster() {
        // Load saved bass boost level
        const savedBass = localStorage.getItem('protomusic_bass_boost');
        this.bassGain = savedBass ? parseFloat(savedBass) : 0;
    }

    setupAudioContext() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaElementSource(this.video);

            // Create bass filter (low-shelf)
            this.bassFilter = this.audioContext.createBiquadFilter();
            this.bassFilter.type = 'lowshelf';
            this.bassFilter.frequency.value = 200; // Hz
            this.bassFilter.gain.value = this.bassGain;

            // Connect: source -> bass filter -> destination
            source.connect(this.bassFilter);
            this.bassFilter.connect(this.audioContext.destination);
        } catch (e) {
            console.warn('Bass booster not supported:', e);
        }
    }

    setBassBoost(level) {
        this.bassGain = Math.max(0, Math.min(15, level));
        if (this.bassFilter) {
            this.bassFilter.gain.value = this.bassGain;
        }
        localStorage.setItem('protomusic_bass_boost', this.bassGain);
    }

    hidePlayerIfEmpty() {
        const miniPlayer = document.querySelector('.mini-player');
        const mainContent = document.querySelector('.main-content');

        if (miniPlayer) {
            if (!this.currentVideo) {
                // Remove visible class for slide-down animation
                miniPlayer.classList.remove('visible');
                // Remove extra padding when player is hidden
                if (mainContent) {
                    mainContent.classList.remove('has-player');
                }
            } else {
                // Add visible class for slide-up animation
                miniPlayer.classList.add('visible');
                miniPlayer.style.display = 'flex';
                // Add extra padding when player is visible
                if (mainContent) {
                    mainContent.classList.add('has-player');
                }
            }
        }
    }

    initMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        }
    }

    loadVolume() {
        const saved = localStorage.getItem('protomusic_volume');
        return saved ? parseFloat(saved) : 0.8;
    }

    saveVolume(volume) {
        localStorage.setItem('protomusic_volume', volume);
    }

    /**
     * Play a video
     * @param {Object} videoData - Video object with id, title, owner_name, thumbnail
     */
    async playVideo(videoData) {
        this.currentVideo = videoData;

        // Check if mini player window is active (Electron mode)
        const isMiniPlayerActive = window.electronAPI && window.electronAPI.isMiniPlayerActive;

        if (isMiniPlayerActive && typeof isMiniPlayerActive === 'function') {
            const isActive = await isMiniPlayerActive();
            console.log('🎵 Mini player active?', isActive);

            if (isActive) {
                // Send video to mini player instead of playing in main window
                console.log('🎵 Sending video update to mini player');
                const videoDataForMini = {
                    title: videoData.title,
                    artist: videoData.owner_name || 'Inconnu',
                    streamUrl: api.getStreamUrl(videoData.video_id),
                    thumbnailUrl: api.getThumbnailUrl(videoData.video_id),
                    currentTime: 0
                };
                window.electronAPI.updateMiniPlayerVideo(videoDataForMini);

                // Don't play in main window
                console.log('🎵 Not playing in main window (mini player active)');
                return;
            }
        }

        // Normal playback (no mini player or not active)
        // Show the mini-player
        this.hidePlayerIfEmpty();

        // Setup audio context on first play
        this.setupAudioContext();

        // Update UI
        this.updateNowPlaying();

        // Try HLS first, fallback to direct
        const streamUrl = api.getStreamUrl(videoData.video_id);
        const directUrl = api.getDirectUrl(videoData.video_id);

        // Destroy existing HLS instance
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        // Try HLS
        if (window.Hls && Hls.isSupported()) {
            this.hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60
            });

            this.hls.loadSource(streamUrl);
            this.hls.attachMedia(this.video);

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.play();
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.warn('HLS failed, falling back to direct URL');
                    this.video.src = directUrl;
                    this.play();
                }
            });
        } else {
            // Direct playback
            this.video.src = directUrl;
            this.play();
        }

        // Track view
        try {
            await api.trackView(videoData.video_id);
        } catch (e) {
            console.warn('Failed to track view:', e);
        }

        // Update Media Session
        this.updateMediaSession();

        // Check for Season 8 intro skip
        this.checkSeason8IntroSkip(videoData);
    }

    updateNowPlaying() {
        if (!this.currentVideo) return;

        const { title, owner_name, video_id } = this.currentVideo;
        // Resolve thumbnail with fallback logic
        const proxyThumbUrl = api.getThumbnailUrl(video_id);
        const resolvedThumbUrl = this._resolveThumbnailUrl(this.currentVideo);

        // Mini player thumbnail with fallback
        if (this.miniThumbnail) {
            this.miniThumbnail.src = resolvedThumbUrl;
            this.miniThumbnail.onerror = () => {
                if (this.miniThumbnail.src !== proxyThumbUrl) {
                    this.miniThumbnail.src = proxyThumbUrl;
                } else {
                    this.miniThumbnail.onerror = null;
                    this.miniThumbnail.style.display = 'none';
                }
            };
            this.miniThumbnail.style.display = '';
        }
        if (this.miniTitle) {
            this.miniTitle.textContent = title;

            // Always set data-text for potential marquee
            this.miniTitle.setAttribute('data-text', title);

            // Enable scrolling marquee for long titles (always on mobile)
            if (window.innerWidth <= 768) {
                // Use a simpler check: if title is longer than 20 chars, enable scroll
                if (title.length > 20) {
                    this.miniTitle.classList.add('scrolling');
                } else {
                    this.miniTitle.classList.remove('scrolling');
                }
            } else {
                this.miniTitle.classList.remove('scrolling');
            }
        }
        if (this.miniArtist) this.miniArtist.textContent = owner_name || 'Inconnu';

        // Full player
        if (this.fullTitle) this.fullTitle.textContent = title;
        if (this.fullArtist) this.fullArtist.textContent = owner_name || 'Inconnu';

        // Update favorites button state
        this.updateFullPlayerFavoriteUI();
        this.updateMiniFavoriteUI();

        // Apply ambient background
        this.applyAmbientBackground(proxyThumbUrl);
    }

    // Resolve thumbnail URL: custom → proxy fallback
    _resolveThumbnailUrl(video) {
        const baseUrl = (window.api && window.api.baseUrl) || 'https://protomusic-proxy.onrender.com';
        const proxyUrl = api.getThumbnailUrl(video.video_id);

        if (video.thumbnail && video.thumbnail.trim() !== '') {
            if (video.thumbnail.startsWith('http')) {
                return video.thumbnail;
            } else {
                const path = video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail;
                return `${baseUrl}${path}`;
            }
        }
        return proxyUrl;
    }

    async applyAmbientBackground(imageUrl) {
        console.log('🎨 Player: Trying ambient background', {
            extractDominantColor: typeof extractDominantColor,
            imageUrl
        });

        try {
            const color = await extractDominantColor(imageUrl);
            console.log('🎨 Player: Color extracted', color);
            const { r, g, b } = color;

            // Apply to full player overlay
            const overlay = document.getElementById('fullPlayerOverlay');
            if (overlay) {
                const gradient = `
                    radial-gradient(
                        ellipse at 50% 50%,
                        rgba(${r}, ${g}, ${b}, 0.4) 0%,
                        rgba(${r}, ${g}, ${b}, 0.25) 30%,
                        rgba(${r}, ${g}, ${b}, 0.12) 50%,
                        rgba(15, 15, 15, 1) 80%
                    )
                `;

                overlay.style.background = gradient;
                overlay.style.backgroundColor = '#0F0F0F';
                overlay.style.transition = 'background 2s cubic-bezier(0.4, 0, 0.2, 1)';
                overlay.style.animation = 'ambientPulse 8s ease-in-out infinite';
                console.log('🎨 Player: Background applied successfully!');

                // Add animation if needed
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
            }
        } catch (error) {
            console.error('🎨 Player: ERROR applying ambient background:', error);
        }
    }

    updateMediaSession() {
        if (!('mediaSession' in navigator) || !this.currentVideo) return;

        const { title, owner_name, thumbnail, video_id } = this.currentVideo;
        const thumbnailUrl = thumbnail || api.getThumbnailUrl(video_id);

        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: owner_name || 'ProtoMusic',
            artwork: [
                { src: thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
    }

    play() {
        this.video.play().catch(e => console.warn('Playback failed:', e));
    }

    pause() {
        this.video.pause();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    onPlay() {
        this.isPlaying = true;
        this.updatePlayButtons(true);

        // Discord RPC Update
        if (this.currentVideo && typeof updateDiscordRPC === 'function') {
            updateDiscordRPC(this.currentVideo, true);
        }
    }

    onPause() {
        this.isPlaying = false;
        this.updatePlayButtons(false);

        // Discord RPC Update
        if (this.currentVideo && typeof updateDiscordRPC === 'function') {
            updateDiscordRPC(this.currentVideo, false);
        }
    }

    updatePlayButtons(isPlaying) {
        // Mini player
        const playIcon = this.playPauseBtn?.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn?.querySelector('.pause-icon');
        if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
        if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);

        // Full player
        const fullPlayIcon = this.fullPlayPauseBtn?.querySelector('.play-icon');
        const fullPauseIcon = this.fullPlayPauseBtn?.querySelector('.pause-icon');
        if (fullPlayIcon) fullPlayIcon.classList.toggle('hidden', isPlaying);
        if (fullPauseIcon) fullPauseIcon.classList.toggle('hidden', !isPlaying);
    }

    updateProgress() {
        const { currentTime, duration } = this.video;

        if (duration) {
            // Progress bar
            const percent = (currentTime / duration) * 100;
            if (this.miniProgressBar) this.miniProgressBar.style.width = `${percent}%`;
            if (this.progressSlider) this.progressSlider.value = percent;

            // Time displays
            const current = this.formatTime(currentTime);
            const total = this.formatTime(duration);

            if (this.currentTimeEl) this.currentTimeEl.textContent = current;
            if (this.durationEl) this.durationEl.textContent = total;
            if (this.fullCurrentTime) this.fullCurrentTime.textContent = current;
            if (this.fullDuration) this.fullDuration.textContent = total;
        }
    }

    onMetadataLoaded() {
        const duration = this.formatTime(this.video.duration);
        if (this.durationEl) this.durationEl.textContent = duration;
        if (this.fullDuration) this.fullDuration.textContent = duration;
    }

    onEnded() {
        if (this.repeatMode === 'one') {
            this.video.currentTime = 0;
            this.play();
        } else if (this.queue.length > 0 && this.queueIndex < this.queue.length - 1) {
            this.next();
        } else if (this.repeatMode === 'all' && this.queue.length > 0) {
            this.queueIndex = 0;
            this.playVideo(this.queue[0]);
        } else {
            // Clear Discord RPC when playback ends
            if (typeof clearDiscordRPC === 'function') {
                clearDiscordRPC();
            }
        }
    }

    next() {
        if (this.queue.length === 0) return;

        if (this.isShuffle) {
            const randomIndex = Math.floor(Math.random() * this.queue.length);
            this.queueIndex = randomIndex;
        } else {
            this.queueIndex = (this.queueIndex + 1) % this.queue.length;
        }

        this.playVideo(this.queue[this.queueIndex]);
    }

    previous() {
        if (this.video.currentTime > 3) {
            this.video.currentTime = 0;
            return;
        }

        if (this.queue.length === 0) return;

        this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
        this.playVideo(this.queue[this.queueIndex]);
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.video.volume = this.volume;
        this.saveVolume(this.volume);
        if (this.volumeSlider) this.volumeSlider.value = this.volume * 100;
        this.updateVolumeIcon();
    }

    toggleMute() {
        if (this.video.muted) {
            this.video.muted = false;
            this.setVolume(this.volume || 0.5);
        } else {
            this.video.muted = true;
        }
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const highIcon = this.volumeBtn?.querySelector('.volume-high');
        const mutedIcon = this.volumeBtn?.querySelector('.volume-muted');

        if (this.video.muted || this.volume === 0) {
            highIcon?.classList.add('hidden');
            mutedIcon?.classList.remove('hidden');
        } else {
            highIcon?.classList.remove('hidden');
            mutedIcon?.classList.add('hidden');
        }
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        this.shuffleBtn?.classList.toggle('active', this.isShuffle);
    }

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];

        this.repeatBtn?.classList.toggle('active', this.repeatMode !== 'none');

        // Update icon for repeat one
        if (this.repeatMode === 'one') {
            this.repeatBtn?.classList.add('repeat-one');
        } else {
            this.repeatBtn?.classList.remove('repeat-one');
        }
    }

    toggleQueuePanel() {
        if (this.queuePanel?.classList.contains('hidden')) {
            this.showQueuePanel();
        } else {
            this.hideQueuePanel();
        }
    }

    showQueuePanel() {
        this.queuePanel?.classList.remove('hidden');
        this.renderQueue();
    }

    hideQueuePanel() {
        this.queuePanel?.classList.add('hidden');
    }

    renderQueue() {
        if (!this.queueCurrentItem || !this.queueList || !this.queueEmpty) return;

        // Render current playing
        if (this.currentVideo) {
            const thumbnailUrl = this.currentVideo.thumbnail || api.getThumbnailUrl(this.currentVideo.video_id);
            this.queueCurrentItem.innerHTML = `
                <div class="queue-item active">
                    <div class="queue-item-thumbnail">
                        <img src="${thumbnailUrl}" alt="">
                    </div>
                    <div class="queue-item-info">
                        <div class="queue-item-title">${this.escapeHtml(this.currentVideo.title)}</div>
                        <div class="queue-item-artist">${this.escapeHtml(this.currentVideo.owner_name || 'Inconnu')}</div>
                    </div>
                </div>
            `;
        } else {
            this.queueCurrentItem.innerHTML = '<p style="color: var(--text-tertiary); padding: 10px;">Aucune lecture</p>';
        }

        // Render upcoming queue
        const upcomingVideos = this.queue.filter((v, i) => i > this.queueIndex);

        if (upcomingVideos.length > 0) {
            this.queueEmpty?.classList.add('hidden');
            this.queueList.innerHTML = '';

            upcomingVideos.forEach((video, index) => {
                const realIndex = this.queueIndex + 1 + index;
                const thumbnailUrl = video.thumbnail || api.getThumbnailUrl(video.video_id);

                const itemEl = document.createElement('div');
                itemEl.className = 'queue-item';
                itemEl.innerHTML = `
                    <span class="queue-item-number">${index + 1}</span>
                    <div class="queue-item-thumbnail">
                        <img src="${thumbnailUrl}" alt="">
                    </div>
                    <div class="queue-item-info">
                        <div class="queue-item-title">${this.escapeHtml(video.title)}</div>
                        <div class="queue-item-artist">${this.escapeHtml(video.owner_name || 'Inconnu')}</div>
                    </div>
                    <button class="queue-item-remove" data-index="${realIndex}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                `;

                // Click to play
                itemEl.addEventListener('click', (e) => {
                    if (!e.target.closest('.queue-item-remove')) {
                        this.queueIndex = realIndex;
                        this.playVideo(this.queue[realIndex]);
                        this.renderQueue();
                    }
                });

                // Remove button
                const removeBtn = itemEl.querySelector('.queue-item-remove');
                removeBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.queue.splice(realIndex, 1);
                    this.renderQueue();
                });

                this.queueList.appendChild(itemEl);
            });
        } else {
            this.queueList.innerHTML = '';
            this.queueEmpty?.classList.remove('hidden');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showFullPlayer() {
        this.fullPlayerOverlay?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Apply video mode setting: show video or thumbnail-only
        this._applyVideoMode();
    }

    _applyVideoMode() {
        try {
            const settings = JSON.parse(localStorage.getItem('protomusic_settings') || '{}');
            const showVideo = settings.videoMode !== false; // default true

            const videoEl = document.getElementById('videoPlayer');
            const videoContainer = document.querySelector('.video-container');
            if (!videoContainer) return;

            // Remove existing thumbnail cover if any
            let cover = videoContainer.querySelector('.video-thumb-cover');

            if (!showVideo) {
                // Hide video element
                if (videoEl) videoEl.style.display = 'none';

                // Show thumbnail cover
                if (!cover) {
                    cover = document.createElement('div');
                    cover.className = 'video-thumb-cover';
                    videoContainer.appendChild(cover);
                }

                // Resolve thumbnail with fallback
                const resolvedThumb = this.currentVideo ? this._resolveThumbnailUrl(this.currentVideo) : '';
                const proxyThumb = this.currentVideo ? api.getThumbnailUrl(this.currentVideo.video_id) : '';

                // Apply styles for album art display
                Object.assign(cover.style, {
                    display: 'flex',
                    backgroundImage: `url("${resolvedThumb}")`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundColor: '#0a0a0a',
                    position: 'absolute',
                    inset: '0',
                    borderRadius: '12px',
                    alignItems: 'center',
                    justifyContent: 'center',
                });

                // Fallback: if custom thumb fails, try proxy
                if (resolvedThumb && resolvedThumb !== proxyThumb) {
                    const img = new Image();
                    img.onerror = () => {
                        cover.style.backgroundImage = `url("${proxyThumb}")`;
                    };
                    img.src = resolvedThumb;
                }
            } else {
                // Show video normally
                if (videoEl) videoEl.style.display = '';
                if (cover) cover.style.display = 'none';
            }
        } catch (e) {
            console.warn('videoMode apply failed:', e);
        }
    }

    hideFullPlayer() {
        this.fullPlayerOverlay?.classList.add('hidden');
        document.body.style.overflow = '';
        // Always restore video visibility when closing full player
        const videoEl = document.getElementById('videoPlayer');
        if (videoEl) videoEl.style.display = '';
        const cover = document.querySelector('.video-thumb-cover');
        if (cover) cover.style.display = 'none';
    }

    minimize() {
        console.log('🎵 minimize() called');

        // Check if running in Electron using the preload API
        const isElectron = window.electronAPI && window.electronAPI.isElectron();

        console.log('🎵 window.electronAPI exists:', !!window.electronAPI);
        console.log('🎵 isElectron:', isElectron);

        if (isElectron) {
            console.log('🎵 ✓ Running in Electron - opening always-on-top window');

            try {
                if (!this.currentVideo) {
                    console.warn('⚠️ No video playing');
                    alert('Jouez une vidéo avant d\'ouvrir le mini-player !');
                    return;
                }

                const videoData = {
                    title: this.currentVideo.title,
                    artist: this.currentVideo.owner_name || 'Inconnu',
                    streamUrl: api.getStreamUrl(this.currentVideo.video_id),
                    thumbnailUrl: api.getThumbnailUrl(this.currentVideo.video_id),
                    currentTime: this.video.currentTime,
                    duration: this.currentVideo.duration,  // Added duration for Discord RPC logic
                    volume: this.video.volume // Sync volume
                };

                console.log('🎵 📤 Sending IPC: open-mini-player');
                console.log('🎵 Video data:', videoData);

                // Use electronAPI instead of require('electron')
                window.electronAPI.openMiniPlayer(videoData);

                console.log('🎵 ✓ IPC sent successfully via electronAPI');

                // IMPORTANT: Pause main video to avoid dual playback
                this.video.pause();
                console.log('🎵 Main video paused');

                // Hide full player
                setTimeout(() => this.hideFullPlayer(), 500);
            } catch (error) {
                console.error('❌ Error opening Electron mini player:', error);
                alert('Erreur : ' + error.message);
            }
        } else {
            console.log('🎵 ⚠️ Not in Electron - mini player only available in desktop app');
            alert('Le mini lecteur est uniquement disponible sur l\'application bureau.');
        }
    }

    showLoading() {
        // Add loading indicator
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleKeyboard(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.video.currentTime -= 5;
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.video.currentTime += 5;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setVolume(this.volume + 0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.setVolume(this.volume - 0.1);
                break;
            case 'KeyM':
                if (e.ctrlKey && this.currentVideo) {
                    // Ctrl+M = Minimize to floating player
                    e.preventDefault();
                    this.minimize();
                } else {
                    // M alone = Toggle mute
                    this.toggleMute();
                }
                break;
            case 'Escape':
                this.hideFullPlayer();
                break;
        }
    }

    /**
     * Add videos to queue
     * @param {Array} videos - Array of video objects
     * @param {boolean} playFirst - Whether to play the first video
     */
    setQueue(videos, playFirst = true) {
        this.queue = videos;
        this.queueIndex = 0;

        if (playFirst && videos.length > 0) {
            this.playVideo(videos[0]);
        }
    }

    /**
     * Add a single video to queue and play it
     * @param {Object} video - Video object
     */
    addAndPlay(video) {
        const existingIndex = this.queue.findIndex(v => v.video_id === video.video_id);

        if (existingIndex !== -1) {
            this.queueIndex = existingIndex;
        } else {
            this.queue.push(video);
            this.queueIndex = this.queue.length - 1;
        }

        this.playVideo(video);
    }

    /**
     * Add video to end of queue without playing
     * @param {Object} video - Video object
     */
    addToQueue(video) {
        const existingIndex = this.queue.findIndex(v => v.video_id === video.video_id);

        if (existingIndex === -1) {
            this.queue.push(video);
            this.renderQueue();

            console.log(`✓ Ajouté à la file d'attente: ${video.title}`);
        } else {
            console.log(`✓ Déjà dans la file d'attente`);
        }
    }

    /**
     * Add video right after current song (play next)
     * @param {Object} video - Video object
     */
    addToQueueNext(video) {
        const existingIndex = this.queue.findIndex(v => v.video_id === video.video_id);

        // Remove if already exists
        if (existingIndex !== -1) {
            this.queue.splice(existingIndex, 1);
            // Adjust current index if needed
            if (existingIndex <= this.queueIndex) {
                this.queueIndex = Math.max(0, this.queueIndex - 1);
            }
        }

        // Insert right after current song
        this.queue.splice(this.queueIndex + 1, 0, video);
        this.renderQueue();

        console.log(`✓ Sera joué ensuite: ${video.title}`);
    }

    toggleFullPlayerFavorite() {
        const appRef = window.app;
        if (!this.currentVideo || !appRef) return;

        appRef.toggleFavorite(this.currentVideo);
        const isFavorite = appRef.favorites.has(this.currentVideo.video_id);

        // Update button state
        this.fullFavoriteBtn?.classList.toggle('active', isFavorite);
        if (this.fullFavoriteText) {
            this.fullFavoriteText.textContent = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
        }

        // Update SVG fill
        const svg = this.fullFavoriteBtn?.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
        }

        // Also update mini player button
        this.updateMiniFavoriteUI();
    }

    toggleMiniFavorite() {
        const appRef = window.app;
        if (!this.currentVideo || !appRef) return;

        appRef.toggleFavorite(this.currentVideo);
        this.updateMiniFavoriteUI();

        // Also update full player button if visible
        this.updateFullPlayerFavoriteUI();
    }

    updateMiniFavoriteUI() {
        const appRef = window.app;
        if (!this.currentVideo || !appRef) return;

        const isFavorite = appRef.favorites.has(this.currentVideo.video_id);

        // Update button state
        this.miniFavoriteBtn?.classList.toggle('active', isFavorite);

        // Update SVG fill
        const svg = this.miniFavoriteBtn?.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
        }
    }

    updateFullPlayerFavoriteUI() {
        const appRef = window.app;
        if (!this.currentVideo || !appRef) return;

        const isFavorite = appRef.favorites.has(this.currentVideo.video_id);

        // Update button state
        this.fullFavoriteBtn?.classList.toggle('active', isFavorite);
        if (this.fullFavoriteText) {
            this.fullFavoriteText.textContent = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
        }

        // Update SVG fill
        const svg = this.fullFavoriteBtn?.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
        }
    }

    checkSeason8IntroSkip(video) {
        // Check if Season 8 intro skip is enabled in settings
        if (window.settingsManager && settingsManager.settings.skipSeason8Intro) {
            // Check if video is from Season 8 (owner_name contains "Saison 8")
            if (video.owner_name && video.owner_name.includes('Saison 8')) {
                // Wait for video to be ready, then skip 8 seconds
                const skipIntro = () => {
                    if (this.video.readyState >= 2 && this.video.currentTime < 1) {
                        this.video.currentTime = 8;
                        this.video.removeEventListener('loadeddata', skipIntro);
                    }
                };
                this.video.addEventListener('loadeddata', skipIntro);
            }
        }
    }

    async reloadQueue() {
        // Only reload if there's a current video playing
        if (!this.currentVideo) return;

        if (window.app && typeof app.reloadKikiskothekQueue === 'function') {
            // Check if we're on Kikiskothèque page
            if (app.currentPage === 'kikiskotheque') {
                await app.reloadKikiskothekQueue();
            } else {
                // For other pages, rebuild queue from visible videos
                const currentPageElement = document.querySelector(`.page[data-page="${app.currentPage}"].active`);
                const allCards = currentPageElement ? currentPageElement.querySelectorAll('.video-card') : [];

                const allVideos = [];
                allCards.forEach(card => {
                    const videoId = card.dataset.videoId;
                    if (videoId) {
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

                if (allVideos.length > 0) {
                    // Keep current video, add rest of visible videos
                    const currentIndex = allVideos.findIndex(v => v.video_id === this.currentVideo.video_id);
                    if (currentIndex !== -1) {
                        const reordered = [
                            ...allVideos.slice(currentIndex),
                            ...allVideos.slice(0, currentIndex)
                        ];
                        this.queue = reordered;
                        this.queueIndex = 0;
                    } else {
                        this.queue = [this.currentVideo, ...allVideos];
                        this.queueIndex = 0;
                    }
                    this.renderQueue();
                }
            }
        }
    }
}

// Global player instance
let player;

document.addEventListener('DOMContentLoaded', () => {
    player = new ProtoMusicPlayer();
});
