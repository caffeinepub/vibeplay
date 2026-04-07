import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type UserId = bigint;
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export type AuthResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface backendInterface {
    addSongToPlaylist(token: string, playlistId: bigint, videoId: string): Promise<Result>;
    createPlaylist(token: string, name: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deletePlaylist(token: string, playlistId: bigint): Promise<Result>;
    getLikedSongs(token: string): Promise<{
        __kind__: "ok";
        ok: Array<string>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMe(token: string): Promise<{
        id: UserId;
        username: string;
        email: string;
    } | null>;
    getPlaylists(token: string): Promise<{
        __kind__: "ok";
        ok: Array<{
            id: bigint;
            name: string;
            videoIds: Array<string>;
        }>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    likeSong(token: string, videoId: string): Promise<Result>;
    login(email: string, passHash: string): Promise<AuthResult>;
    logout(token: string): Promise<Result>;
    register(email: string, passHash: string): Promise<AuthResult>;
    removeSongFromPlaylist(token: string, playlistId: bigint, videoId: string): Promise<Result>;
    unlikeSong(token: string, videoId: string): Promise<Result>;
}
