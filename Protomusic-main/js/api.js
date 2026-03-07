/**
 * ProtoMusic API Service - PWA Version
 * Direct connection to v2.protogen.fr (no proxy)
 * Optimized: request deduplication + in-memory cache with TTL
 */

const SITE_BASE = 'https://v2.protogen.fr'
const API_BASE = 'https://v2.protogen.fr/api/'
const ENCODER_API_BASE = 'https://v2.protogen.fr/webapi'

class ProtoMusicAPI {
    constructor() {
        this.baseUrl = API_BASE;
        this.siteUrl = SITE_BASE;
        this.encoderUrl = ENCODER_API_BASE;

        // In-flight request deduplication: url → Promise
        this._inflight = new Map();

        // In-memory response cache: url → { data, expiry }
        this._cache = new Map();
        this._cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Cached + deduplicated fetch.
     * @param {string} endpoint - relative to baseUrl
     * @param {object} options  - fetch options (optional)
     * @param {boolean} cached  - whether to use the memory cache (default true)
     */
    async request(endpoint, options = {}, cached = true) {
        const fullUrl = `${this.baseUrl}${endpoint}`;

        // 1. Serve from in-memory cache if still fresh
        if (cached && !options.method || options.method === 'GET') {
            const hit = this._cache.get(fullUrl);
            if (hit && Date.now() < hit.expiry) {
                return hit.data;
            }
        }

        // 2. Deduplicate in-flight requests to the same URL
        if (this._inflight.has(fullUrl)) {
            return this._inflight.get(fullUrl);
        }

        const fetchPromise = fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        }).then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();

            // Store in cache for cacheable GET requests
            if (cached && (!options.method || options.method === 'GET')) {
                this._cache.set(fullUrl, { data, expiry: Date.now() + this._cacheTTL });
            }

            return data;
        }).catch(error => {
            console.error('[API] Error:', error.message);
            throw error;
        }).finally(() => {
            this._inflight.delete(fullUrl);
        });

        this._inflight.set(fullUrl, fetchPromise);
        return fetchPromise;
    }

    /** Bypass cache explicitly (for user-triggered refreshes) */
    async requestFresh(endpoint, options = {}) {
        const fullUrl = `${this.baseUrl}${endpoint}`;
        this._cache.delete(fullUrl);
        return this.request(endpoint, options, false);
    }

    async getPublicMedia(limit = 20, offset = 0) {
        return this.request(`/media/getPublicMedia?limit=${limit}&offset=${offset}`);
    }

    async getMostViewedMedia(limit = 8, offset = 0) {
        return this.request(`/media/getMostViewedMedia?limit=${limit}&offset=${offset}`);
    }

    async getRandomMedia(limit = 20, exclude = []) {
        try {
            const result = await this.getPublicMedia(50, 0);
            if (result.success && result.videos) {
                let available = result.videos.filter(v => !exclude.includes(v.video_id));
                for (let i = available.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [available[i], available[j]] = [available[j], available[i]];
                }
                return { success: true, videos: available.slice(0, limit) };
            }
            return { success: false, videos: [] };
        } catch (error) {
            console.error('getRandomMedia failed:', error);
            return { success: false, videos: [] };
        }
    }

    async search(query) {
        try {
            const result = await this.request(`/search/autocomplete?q=${encodeURIComponent(query)}`, {}, false);
            if (result.success && result.videos) return result;
        } catch (error) {
            console.warn('Search API failed');
        }
        return { success: false, videos: [] };
    }

    async getSeries() {
        try {
            const data = await this.request(`/kikiskothek/getSeasons`);

            if (data && data.success && data.seasons && data.seasons.length > 0) {
                const seriesList = data.seasons.map(season => ({
                    series_id: season.season_number !== undefined ? String(season.season_number) : String(season.id),
                    season_name: season.title || `Saison ${season.season_number}`,
                    episode_count: season.episode_count || 0,
                    thumbnail: season.thumbnail || null,
                    description: season.description || ''
                }));

                // Ensure Kalandar is always available in the UI
                if (!seriesList.some(s => s.series_id === 'kalandar')) {
                    seriesList.push({ series_id: 'kalandar', season_name: 'Kalandar', episode_count: 25 });
                }

                return { success: true, series: seriesList };
            }

            return this.getFallbackSeasons();
        } catch (error) {
            console.warn('Failed to fetch seasons from API:', error);
            return this.getFallbackSeasons();
        }
    }

    getFallbackSeasons() {
        const seasons = [
            { series_id: '10', season_name: 'Saison 10', episode_count: 0 },
            { series_id: '9', season_name: 'Saison 9', episode_count: 1 },
            { series_id: '8', season_name: 'Saison 8', episode_count: 15 },
            { series_id: '7', season_name: 'Saison 7', episode_count: 23 },
            { series_id: '6', season_name: 'Saison 6', episode_count: 15 },
            { series_id: '5', season_name: 'Saison 5', episode_count: 16 },
            { series_id: '4', season_name: 'Saison 4', episode_count: 15 },
            { series_id: '3', season_name: 'Saison 3', episode_count: 14 },
            { series_id: '2', season_name: 'Saison 2', episode_count: 15 },
            { series_id: '1', season_name: 'Saison 1', episode_count: 13 },
            { series_id: 'kalandar', season_name: 'Kalandar', episode_count: 25 },
            { series_id: 'autre', season_name: 'Autre', episode_count: 34 }
        ];
        return { success: true, series: seasons };
    }

    async getEpisodes(seasonId) {
        try {
            const data = await this.request(`/kikiskothek/getEpisodes?season_number=${seasonId}`);

            if (data && data.success && data.episodes && data.episodes.length > 0) {
                return {
                    success: true,
                    episodes: data.episodes.map((ep, i) => ({
                        video_id: ep.video_id,
                        episode_number: ep.episode_number || (i + 1),
                        title: ep.display_title || ep.episode_title || ep.video_title,
                        thumbnail: ep.custom_thumbnail || this.getThumbnailUrl(ep.video_id),
                        owner_name: ep.owner_display_name || ep.owner_username || `Saison ${seasonId}`,
                        duration: ep.duration_formatted || '0:00',
                        views: ep.views || 0
                    }))
                };
            }

            return { success: true, episodes: [] };
        } catch (error) {
            console.warn('Failed to fetch episodes from API:', error);
            return { success: true, episodes: [] };
        }
    }

    async trackView(videoId) {
        // Track views without caching and without blocking UI (fire-and-forget)
        return this.request(`/media/trackView?video_id=${videoId}`, {}, false);
    }

    resolveThumbnail(video) {
        if (video && video.thumbnail && video.thumbnail.trim() !== '') {
            if (video.thumbnail.startsWith('http')) {
                return video.thumbnail;
            }
            const path = video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail;
            return `${this.siteUrl}${path}`;
        }
        if (video && video.video_id) {
            return this.getThumbnailUrl(video.video_id);
        }
        return '';
    }

    getThumbnailUrl(videoId) {
        return `${this.encoderUrl}/media/thumb/${videoId}`;
    }

    getStreamUrl(videoId) {
        return `${this.encoderUrl}/media/stream/${videoId}/master.m3u8`;
    }

    getDirectUrl(videoId) {
        return `${this.encoderUrl}/media/video/${videoId}`;
    }
}

// Global API instance
const api = new ProtoMusicAPI();
window.api = api;
