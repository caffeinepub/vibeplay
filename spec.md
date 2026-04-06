# VibePlay — Search & Home Update

## Current State
- Search uses `useSmartSearch` (Spotify + YouTube parallel), `deduplicateVersions`, `rankSearchResults`
- Results include ALL YouTube videos including Shorts, remixes, lofi, etc.
- YouTube search has no `videoDuration` or `safeSearch` filters
- Keyword filtering only exists in recommendations (not search)
- Search tabs: All, Songs, Artists, Trending (no Songs/Videos split)
- No "Official" badge on results
- MOOD_CATEGORIES in mockData includes: chill, sad, gym, focus — gym/chill/focus must be removed
- Home has no "Trending Playlists" section (last build may not have persisted it)
- Up Next (`useRelatedTracks`) uses Spotify + YouTube related + Last.fm; may have caching issues
- YouTube API has 12 keys; 2 new keys to add
- viewport `initial-scale=1.0` doesn't prevent zoom on double-tap

## Requested Changes (Diff)

### Add
- Official-only filter in `useSmartSearch`: `videoDuration=medium` (60s–20min), `safeSearch=strict`, `relevanceLanguage=hi`
- Title keyword blocklist applied to YouTube search results (remix, lofi, slowed, sped up, karaoke, cover, version, edit, shorts, reels, fan made)
- "Official" badge on results from verified/official channels (T-Series, Sony Music, Zee Music, Saregama, etc.)
- Songs/Videos tab split in `SearchScreen` (Songs = audio-focused, Videos = visual music videos)
- `TrendingPlaylists` component with 4 Indian-focus playlists (Love Songs, Party Songs, Heartbreak, Old School Romance)
- `TrendingPlaylists` section at top of HomeScreen replacing current mood section that has gym/chill/focus
- 2 new YouTube API keys: `AIzaSyAEH5Y74v7BPyxeoQm5lJDTFipJq7-wYC0` and `AIzaSyD5ZfbVi42lPN84pGlCNQyoD7vYHa1LqC8`
- `user-scalable=no, maximum-scale=1` in viewport meta to prevent pinch/zoom on all pages

### Modify
- `constants.ts`: add 2 new API keys to `YOUTUBE_API_KEYS` array (total 14)
- `useSmartSearch.ts`: add `videoDuration`, `safeSearch`, `relevanceLanguage` params; post-filter results by blocked keywords; mark official channel results
- `SearchScreen.tsx`: add "Songs" and "Videos" tabs; add Official badge rendering
- `mockData.ts`: remove `gym`, `chill`, `focus` from `MOOD_CATEGORIES`; keep only `sad` (or replace with Indian-focus moods)
- `HomeScreen.tsx`: add `TrendingPlaylists` section above recommendation feed
- `useRelatedTracks.ts`: fix Up Next — ensure track candidates resolve correctly and queue is populated
- `index.html`: add `user-scalable=no, maximum-scale=1` to viewport meta

### Remove
- `gym`, `chill`, `focus` mood categories from home screen
- Non-Indian mood filters that don't align with Indian music focus

## Implementation Plan
1. Update `constants.ts` — add 2 new API keys
2. Update `index.html` — fix viewport meta for no-zoom
3. Update `useSmartSearch.ts` — add official filters, keyword blocking, official channel detection
4. Create `utils/officialFilter.ts` — helper functions for keyword blocking + official channel detection
5. Update `SearchScreen.tsx` — add Official badge, Songs/Videos tab
6. Update `mockData.ts` — remove gym/chill/focus, add Indian-focus mood: Bollywood, Romantic
7. Create `components/TrendingPlaylists.tsx` — 4 Indian playlists with dynamic fetch, skeleton, Play All
8. Update `HomeScreen.tsx` — add TrendingPlaylists above RecommendationFeed
9. Fix `useRelatedTracks.ts` — ensure Up Next populates by improving reliability of Spotify/YouTube candidate resolution
