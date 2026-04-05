# VibePlay – Smart Up Next System

## Current State
- `useRelatedTracks` hook fetches related songs using YouTube's `relatedToVideoId` endpoint as primary source, then falls back to title/artist search query
- YouTube native related videos frequently return the same song in different versions (lofi, slowed, reverb, remix)
- Deduplication (`versionDedup.ts`) and artist diversity logic exist but operate on the already-bad YouTube related data
- `youtubeService.ts` has `searchYouTubeForTrack` that only fetches 3 results and takes the first match — no scoring
- `spotifyService.ts` has `getSpotifyRecommendations` but it is NOT used in `useRelatedTracks` — only in the home recommendation feed
- Spotify Client Secret is currently empty in constants.ts, which means Spotify calls fail silently
- Last.fm `getLastFmSimilarTracks` exists but is also NOT connected to the Up Next system

## Requested Changes (Diff)

### Add
- `utils/youtubeMatchEngine.ts` — AI-based YouTube video matching engine with scoring:
  - Title similarity score (40%)
  - Official audio/video keyword boost (20%)
  - Channel credibility score (15%)
  - Duration matching against Spotify track duration (15%)
  - View count quality signal (10%)
  - Fetches 10–15 results per query, rejects blocked keywords, selects best match
  - Caches matched video ID per song
  - Returns videoId + title + thumbnail + confidence score
- `utils/playHistory.ts` — Maintain last-10-played song history, deduplication by trackName+artist
- Update `constants.ts` — Add Spotify Client Secret

### Modify
- `hooks/useRelatedTracks.ts` — Complete rewrite:
  - PRIMARY: Spotify `/v1/recommendations` with seed_tracks + seed_artists (15–20 tracks)
  - FALLBACK: Last.fm `getLastFmSimilarTracks` if Spotify fails
  - Apply strict anti-repetition against play history (last 10 songs)
  - Apply artist diversity (max 2 per artist)
  - For each Spotify/Last.fm track: run through `youtubeMatchEngine` to get best YouTube videoId
  - Reject videos with blocked keywords in title (remix, lofi, slowed, reverb, cover, live, dj, karaoke, lyrics)
  - Allow only "official audio" or "official video" preferentially; fallback to clean version
  - Preload next 2 tracks after current resolves
  - Build a queue of 10–15 unique, diverse related tracks
- `services/youtubeService.ts` — Replace simple `searchYouTubeForTrack` (3 results, first-pick) with intelligent version that uses the scoring engine
- `services/spotifyService.ts` — Update `getSpotifyRecommendations` to pass current track's Spotify ID as seed, extract artist ID from search results

### Remove
- Remove `relatedToVideoId` YouTube API call from the Up Next system entirely
- Remove the YouTube-native related videos as any primary or fallback source for Up Next

## Implementation Plan
1. Add `SPOTIFY_CLIENT_SECRET` to `constants.ts`
2. Create `utils/playHistory.ts` — read/write last-10 played, dedup by name+artist
3. Create `utils/youtubeMatchEngine.ts` — multi-result fetch + scoring + rejection + cache
4. Rewrite `hooks/useRelatedTracks.ts` — Spotify first → Last.fm fallback → resolve each track via match engine → diversity + dedup filters → return queue of 10–15
5. Update `services/youtubeService.ts` `searchYouTubeForTrack` to use the scoring engine for higher-confidence matches
6. Wire play history tracking into App.tsx when a track starts playing
