# VibePlay

## Current State
- `detectTrackMeta.ts` has `detectLanguage()` and `detectMusicType()` utilities that read language and mood from a song title.
- `useRelatedTracks.ts` fetches related/Up-Next tracks for the player using `relatedToVideoId` (primary) and a title/artist-based fallback query. The fallback query does NOT include language or mood terms.
- `useRecommendationEngine.ts` builds home screen sections. The "Because You Watched" section uses only the cached related tracks from the last played song, with no language/mood-aware re-fetch. The trending fetch uses the user's top tag as a query.
- There is no logic that reads the language or mood of the currently playing song and injects those terms into any recommendation query.

## Requested Changes (Diff)

### Add
- A `buildLanguageMoodQuery(title, channelName)` helper in `useRelatedTracks.ts` (or as a shared util) that:
  1. Detects language using `detectLanguage(title, channel)` — returns e.g. "Hindi", "Haryanvi", "Punjabi"
  2. Detects mood using `detectMusicType(title)` — returns e.g. "Sad", "Romantic", "Party"
  3. **Only applies** if the detected language is one of: Hindi, Haryanvi, Punjabi, Bollywood (Indian languages). English and others are skipped.
  4. Returns a composite search query string e.g. `"Haryanvi sad songs"`, `"Hindi romantic songs"`, `"Punjabi party songs"`

### Modify
- **`useRelatedTracks.ts`** (`fetchRelated` function):
  - After the primary `relatedToVideoId` call and the existing title/artist fallback, add a **third layer**: if the detected language is Indian, also do a search using the `buildLanguageMoodQuery` result and merge those IDs into `primaryIds`.
  - The language+mood query runs only when the fallback is needed OR always as a blend — cap merged total at 10 IDs before fetching details.
- **`useRecommendationEngine.ts`** (`buildSections` function):
  - The "Because You Watched" section currently uses only already-cached related tracks. Enhance it: if `lastPlayed` has an Indian-language title, also fetch (or use cached) a language+mood query for that track, and merge those results into `becauseYouWatched`.
  - The "Recommended for You" section currently uses only the cached related tracks pool. When building the query for the `trendingTracks` fetch, if the user's top tag does not already contain a language keyword, prepend the detected language from the user's most recently played Indian song.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `buildIndianLanguageMoodQuery(title: string, channelName: string): string | null` to `detectTrackMeta.ts`. Returns null for non-Indian or unknown language.
2. Update `useRelatedTracks.ts`: in `fetchRelated`, after existing Steps 1+2, call `buildIndianLanguageMoodQuery` on the current track. If non-null, do a third search API call with that query, merge unique IDs (cap total at 10). Existing dedup/diversity/exploration logic still runs on the merged set.
3. Update `useRecommendationEngine.ts`:
   - In `buildSections`, after resolving `becauseYouWatched` from cache, check if `lastPlayed` has an Indian language. If so, build a language+mood query, check cache for it, and if not cached fetch it and merge into `becauseYouWatched` (dedup + diversity still applied).
   - Cache the language+mood fetch result under `cacheKey('langmood', query)` for 1 hour to avoid extra API calls.
