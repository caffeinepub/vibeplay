/**
 * VibePlay Backend Interface
 *
 * Augmented type definitions for the backend actor methods used by
 * useAuth and useUserData. The generated backend.d.ts has an empty
 * backendInterface — this file provides the concrete method signatures.
 */

export interface AuthUser {
  id: bigint;
  email: string;
  username: string;
}

export interface VibePlayBackend {
  // ── Auth ──────────────────────────────────────────────────────────
  register(
    email: string,
    passwordHash: string,
  ): Promise<{ ok: string } | { err: string }>;

  login(
    email: string,
    passwordHash: string,
  ): Promise<{ ok: string } | { err: string }>;

  logout(sessionToken: string): Promise<void>;

  getMe(sessionToken: string): Promise<AuthUser | null>;

  // ── Liked Songs ───────────────────────────────────────────────────
  getLikedSongs(
    sessionToken: string,
  ): Promise<{ ok: string[] } | { err: string }>;

  likeSong(sessionToken: string, videoId: string): Promise<void>;

  unlikeSong(sessionToken: string, videoId: string): Promise<void>;

  // ── Playlists ─────────────────────────────────────────────────────
  getPlaylists(
    sessionToken: string,
  ): Promise<
    { ok: { id: bigint; name: string; videoIds: string[] }[] } | { err: string }
  >;

  createPlaylist(
    sessionToken: string,
    name: string,
  ): Promise<{ ok: bigint } | { err: string }>;

  deletePlaylist(sessionToken: string, playlistId: bigint): Promise<void>;

  addSongToPlaylist(
    sessionToken: string,
    playlistId: bigint,
    videoId: string,
  ): Promise<void>;

  removeSongFromPlaylist(
    sessionToken: string,
    playlistId: bigint,
    videoId: string,
  ): Promise<void>;
}
