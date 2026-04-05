# VibePlay — Spotify + Last.fm Integration

## Current State

VibePlay is a mobile-first PWA music app using:
- **YouTube API** (10 keys in rotation) for search, playback, and recommendations
- **Motoko backend** for user auth (email/password), liked songs, playlists
- **Smart recommendation engine** in `useRecommendationEngine.ts` using YouTube's `relatedToVideoId`, language/mood detection, behavior tracking
- **Search** in `useYouTubeSearch.ts` with ranking, fuzzy search (Fuse.js), deduplication
- **Constants**: `constants.ts` holds all YouTube keys and fetch helpers
- **Caching**: `apiCache.ts` with 1-hour localStorage TTL
- **UI**: React + TypeScript, dark theme, filter chip bar, bottom nav, player

## Requested Changes (Diff)

### Add
- `src/frontend/src/services/spotifyService.ts` — Spotify Web API integration
  - Client Credentials Flow token fetching (via backend proxy to keep client_secret hidden)
  - `searchTracks(query)` → enriched track metadata (name, artist, album, cover image)
  - `getRecommendations(seedArtists, seedTracks)` → Spotify recommendations
  - Response caching using existing `apiCache.ts`
- `src/frontend/src/services/lastfmService.ts` — Last.fm API integration
  - `getTopTracks(limit)` → global trending tracks
  - `getTopArtists(limit)` → trending artists
  - `getTagTopTracks(tag)` → genre-based music (bollywood, punjabi, etc.)
  - `getSimilarTracks(artist, track)` → similar song recommendations
  - Response caching
- `src/frontend/src/services/youtubeService.ts` — extracted YouTube service
  - `searchYouTube(query)` → search with "official audio" preference
  - `buildPlaybackQuery(songName, artist)` → formats query as "song + artist + official audio"
  - Re-exports key rotation from `constants.ts`
- Motoko backend: `getSpotifyToken()` public query — proxies Spotify Client Credentials OAuth call (HTTP outcall) and caches the token for 55 minutes
- Motoko backend: `getLastFmTopTracks(limit)` and `getLastFmTopArtists(limit)` proxy endpoints (optional — Last.fm API is public, can be called from frontend directly)
- New `src/frontend/src/hooks/useSmartSearch.ts` — combines Spotify search metadata with YouTube playback
  - First fetches Spotify results for rich metadata (track name, artist, album art)
  - Formats YouTube query as "trackName + artistName + official audio"
  - Falls back to direct YouTube search if Spotify fails
- New `src/frontend/src/hooks/useSpotifyRecommendations.ts` — hybrid recommendation hook
  - Combines Spotify recommendations + Last.fm trending
  - Deduplicates using existing `versionDedup.ts` utils
- Updated `useRecommendationEngine.ts` — adds "Trending Now" section from Last.fm and "Similar Artists" section from Spotify
- Updated `useYouTubeSearch.ts` → replaced by `useSmartSearch.ts` for Spotify-enriched results
- Updated `SearchScreen.tsx` — uses smart search, shows album art and Spotify metadata where available
- Updated `HomeScreen.tsx` — new sections: "Trending Now" (Last.fm) and "Similar Artists"
- New `Track` type fields: `artist?`, `album?`, `albumArt?`, `source?: 'spotify' | 'lastfm' | 'youtube'`
- Two new YouTube API keys added to rotation: `AIzaSyCF6vBJ_RcZN9YNuoOVa8a3DBSy6gXh_B8`, `AIzaSyD1ZBkKir687901Sbk8NLm9g71i4rUXo4c`
- Audio quality section: "official audio" query preference, playback quality indicator (Low/Medium/High based on channel name heuristics)

### Modify
- `constants.ts` — add 2 new YouTube API keys to the rotation (total: 12 keys)
- `types.ts` — extend `Track` with optional `artist`, `album`, `albumArt`, `source` fields
- `useYouTubeSearch.ts` → becomes a thin wrapper; smart search logic moved to `useSmartSearch.ts`
- `useRecommendationEngine.ts` — integrate Last.fm trending into "Trending in Your Interest" section and add "Trending Now" and "Similar Artists" sections
- `SearchScreen.tsx` — use smart search hook, display enriched metadata
- `HomeScreen.tsx` — add "Trending Now" and "Similar Artists" home sections from combined Spotify+Last.fm data
- Motoko backend `main.mo` — add Spotify token proxy endpoint

### Remove
- Nothing removed; all existing features preserved

## Implementation Plan

1. **Add 2 new YouTube keys** to `constants.ts`
2. **Extend `types.ts`** with `artist`, `album`, `albumArt`, `source` optional fields on `Track`
3. **Create `spotifyService.ts`** — token fetch (calls `/spotify-token` backend endpoint), search, recommendations, caching
4. **Create `lastfmService.ts`** — top tracks, top artists, tag tracks, similar tracks, caching
5. **Create `youtubeService.ts`** — extracted YouTube search with "official audio" query formatting
6. **Update Motoko backend** — add Spotify Client Credentials proxy (`getSpotifyToken` via HTTP outcall)
7. **Create `useSmartSearch.ts`** — Spotify-first search with YouTube playback fallback
8. **Update `useRecommendationEngine.ts`** — blend in Last.fm trending and Spotify similar artists
9. **Update `SearchScreen.tsx`** — use `useSmartSearch`, show richer metadata
10. **Update `HomeScreen.tsx`** — "Trending Now" from Last.fm, "Similar Artists" from Spotify
11. **Validate and deploy**
