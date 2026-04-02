# VibePlay

## Current State
VibePlay is a mobile-first music streaming web app using YouTube API. It has:
- Home, Search, Player, Library tabs
- Favorites and playlists stored in localStorage (no user accounts)
- 7 YouTube API keys in rotation with caching
- Greeting hardcoded as "Good morning, Deepak"
- TrackItem with heart button tied to localStorage favorites
- LibraryScreen showing localStorage favorites and playlists
- Empty Motoko backend (`actor {}`)

## Requested Changes (Diff)

### Add
- User signup/login system (email + password)
- Motoko backend: users, liked songs, playlists, playlist songs stored per user
- Password hashing (SHA-256 via Web Crypto API on frontend before sending)
- Persistent session (stored in localStorage as userId + sessionToken)
- LoginScreen component (toggle between login and signup)
- Auth context/hook (useAuth) exposing currentUser, login, signup, logout
- After login: greeting updates to "Good morning, [username]" (username = email prefix)
- Heart/favorite actions: if not logged in, prompt login instead of saving
- Playlist create/add: if not logged in, prompt login instead of saving
- Library: if not logged in, show login prompt; if logged in, show user's server-side data
- "Made by Deepak Chahal" attribution tag in home screen footer
- Developer tag displayed in HomeScreen footer area

### Modify
- App.tsx: integrate AuthContext, conditionally use backend vs localStorage for likes/playlists
- HomeScreen: accept optional username prop, show "Good morning, [username]" after login
- LibraryScreen: show login gate if user not logged in; show backend data when logged in
- TrackItem: heart button shows login prompt if user not authenticated
- useLocalStorage hooks remain for guests; backend hooks used for logged-in users
- Motoko main.mo: implement full user auth + data storage

### Remove
- Nothing removed; localStorage fallback remains for guests

## Implementation Plan
1. Generate Motoko backend with: registerUser, loginUser, getLikedSongs, likeSong, unlikeSong, getPlaylists, createPlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist
2. Create useAuth hook connecting to backend for auth state
3. Create LoginScreen component (email/password form, toggle signup/login)
4. Update App.tsx to wrap with auth context and wire up backend data for logged-in users
5. Update HomeScreen to show username in greeting and "made by Deepak Chahal" footer tag
6. Update LibraryScreen to show login gate or backend-powered data
7. Update TrackItem to guard heart/playlist actions behind auth
