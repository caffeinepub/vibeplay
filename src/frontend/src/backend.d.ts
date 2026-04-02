import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;

export interface UserInfo {
    id: bigint;
    email: string;
    username: string;
}

export interface PlaylistInfo {
    id: bigint;
    name: string;
    videoIds: string[];
}

export interface backendInterface {
    // Auth
    register(email: string, passwordHash: string): Promise<{ ok: string } | { err: string }>;
    login(email: string, passwordHash: string): Promise<{ ok: string } | { err: string }>;
    logout(token: string): Promise<{ ok: null } | { err: string }>;
    getMe(token: string): Promise<UserInfo | null>;

    // Liked Songs
    getLikedSongs(token: string): Promise<{ ok: string[] } | { err: string }>;
    likeSong(token: string, videoId: string): Promise<{ ok: null } | { err: string }>;
    unlikeSong(token: string, videoId: string): Promise<{ ok: null } | { err: string }>;

    // Playlists
    getPlaylists(token: string): Promise<{ ok: PlaylistInfo[] } | { err: string }>;
    createPlaylist(token: string, name: string): Promise<{ ok: bigint } | { err: string }>;
    deletePlaylist(token: string, playlistId: bigint): Promise<{ ok: null } | { err: string }>;
    addSongToPlaylist(token: string, playlistId: bigint, videoId: string): Promise<{ ok: null } | { err: string }>;
    removeSongFromPlaylist(token: string, playlistId: bigint, videoId: string): Promise<{ ok: null } | { err: string }>;

    // Optional scaffold method (may not exist at runtime)
    _initializeAccessControlWithSecret?(secret: string): Promise<void>;
}
