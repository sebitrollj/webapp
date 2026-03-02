/**
 * ProtoMusic API Service - PWA Version
 * Using Render proxy to avoid CORS
 */

const API_BASE = 'https://music.sebitroll.net';
const API_XHR = '/api/v1';

class ProtoMusicAPI {
    constructor() {
        this.baseUrl = API_BASE;
    }

    async request(endpoint, options = {}) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${API_XHR}${endpoint}`;
            const fullUrl = `${this.baseUrl}${url}`;

            console.log('[API] Request:', fullUrl);

            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getPublicMedia(limit = 20, offset = 0) {
        return this.request(`/media/getPublicMedia.php?limit=${limit}&offset=${offset}`);
    }

    async getMostViewedMedia(limit = 8, offset = 0) {
        return this.request(`/media/getMostViewedMedia.php?limit=${limit}&offset=${offset}`);
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
            const result = await this.request(`/search/autocomplete.php?q=${encodeURIComponent(query)}`);
            if (result.success && result.videos) return result;
        } catch (error) {
            console.warn('Search API failed');
        }
        return { success: false, videos: [] };
    }

    async getSeries() {
        try {
            const response = await fetch(`${this.baseUrl}/kikiskothek-api/`); // Updated endpoint
            const data = await response.json();

            if (data && data.success && data.seasons && data.seasons.length > 0) {
                const seriesList = data.seasons.map(season => ({
                    series_id: season.series_id,
                    season_name: season.season_name,
                    episode_count: season.episode_count || 0
                }));

                // Ensure Kalandar is always available in the UI even if the API seasons list doesn't include it
                if (!seriesList.some(s => s.series_id === 'kalandar')) {
                    seriesList.push({ series_id: 'kalandar', season_name: 'Kalandar', episode_count: 25 });
                }

                return {
                    success: true,
                    series: seriesList
                };
            }

            // Fallback to hardcoded if API fails
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
            const response = await fetch(`${this.baseUrl}/kikiskothek-api/?season=${seasonId}`); // Updated endpoint
            const data = await response.json();

            if (data && data.success && data.episodes && data.episodes.length > 0) {
                return {
                    success: true,
                    episodes: data.episodes.map((ep, i) => ({
                        video_id: ep.video_id,
                        episode_number: ep.episode_number || (i + 1),
                        title: ep.title,
                        thumbnail: ep.thumbnail || this.getThumbnailUrl(ep.video_id),
                        owner_name: `Saison ${seasonId}`,
                        duration: ep.duration || '0:00'
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
        return this.request('/media/trackView.php');
    }

    getThumbnailUrl(videoId) {
        return `${this.baseUrl}/webapi/media/thumb/${videoId}`;
    }

    getHighResThumbnailUrl(videoId) {
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }

    getStreamUrl(videoId) {
        return `${this.baseUrl}/webapi/media/stream/${videoId}/master.m3u8`;
    }

    getDirectUrl(videoId) {
        return `${this.baseUrl}/webapi/media/video/${videoId}`;
    }
}

// Global API instance
const api = new ProtoMusicAPI();
window.api = api;
