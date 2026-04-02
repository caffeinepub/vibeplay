# VibePlay — Language & Mood Filter Bar

## Current State
- HomeScreen has `InterestPicker` (cold-start modal) with genres: Bollywood, Punjabi, Pop, Hip-Hop, Chill, EDM, Rock, Devotional
- No persistent language/mood filter bar on home screen
- Mood categories shown at bottom of home screen as horizontal scrollable cards (from `MOOD_CATEGORIES` in `mockData.ts`)
- `useRecommendationEngine` has `setInterests(genres: string[])` which accepts tag strings
- SearchScreen already groups results by detected language/type label
- `detectTrackMeta` utility detects language labels for search result grouping

## Requested Changes (Diff)

### Add
- **Persistent scrollable filter chip bar** on the home screen, displayed below the greeting and above "Continue Listening" / recommendation sections
- **Languages chips**: Hindi, Haryanvi, Punjabi, Bollywood
- **Mood chips**: Romantic, Sad, Party, Chill, Workout
- Multiple chips selectable simultaneously (e.g., Hindi + Romantic)
- Selecting a chip triggers YouTube search/recommendations for that language or mood on the home screen
- Selected chips visually highlighted (green accent)
- Haryanvi added to `InterestPicker` genre list alongside existing genres
- Haryanvi added as detectable language in `detectTrackMeta` utility
- When chips are selected, the RecommendationFeed shows filtered/themed content for that selection
- Filter state stored in localStorage so it persists across page reloads

### Modify
- `HomeScreen.tsx` — add the filter chip bar between greeting and Continue Listening section; pass selected filters down or use shared state
- `InterestPicker.tsx` — add Haryanvi (`{ name: "Haryanvi", emoji: "🎵", tag: "haryanvi" }`) to `GENRES` array, increase MAX_SELECT to 4
- `detectTrackMeta` utility — add Haryanvi keywords to language detection logic
- `useRecommendationEngine.ts` — when active filters change, trigger a YouTube search for those filter keywords and inject results as a new recommendation section ("Hindi Mix", "Haryanvi Hits", "Romantic Vibes", etc.)
- `App.tsx` — wire up `activeFilters` state from HomeScreen to recommendation engine

### Remove
- Nothing removed

## Implementation Plan
1. Add Haryanvi to `InterestPicker.tsx` GENRES list
2. Add Haryanvi detection keywords to `detectTrackMeta` utility
3. Create `FilterChipBar` component: scrollable chip bar with language + mood chips, multi-select, green highlight for selected
4. Add `activeFilters` state to `HomeScreen.tsx` (or `App.tsx`), persisted in localStorage
5. Render `FilterChipBar` in `HomeScreen.tsx` below the greeting section
6. In `useRecommendationEngine.ts`, add a method `setActiveFilters(filters: string[])` that:
   - When filters are selected, fires a YouTube search for the filter keywords
   - Injects results as a top-priority recommendation section titled after the selected filter(s)
   - Caches results for 1 hour per filter combo
   - When no filters selected, falls back to normal recommendation sections
7. Wire `activeFilters` from HomeScreen → App → recommendationEngine.setActiveFilters
