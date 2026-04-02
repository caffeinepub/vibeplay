/* eslint-disable */
// @ts-nocheck
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';

export type AuthResult = { 'ok': string } | { 'err': string };
export type Result = { 'ok': null } | { 'err': string };
export type ResultNat = { 'ok': bigint } | { 'err': string };
export type ResultStrings = { 'ok': Array<string> } | { 'err': string };

export interface PlaylistInfo {
  'id': bigint;
  'name': string;
  'videoIds': Array<string>;
}
export type ResultPlaylists = { 'ok': Array<PlaylistInfo> } | { 'err': string };

export interface UserInfo {
  'id': bigint;
  'email': string;
  'username': string;
}

export interface _SERVICE {
  'register': ActorMethod<[string, string], AuthResult>;
  'login': ActorMethod<[string, string], AuthResult>;
  'logout': ActorMethod<[string], Result>;
  'getMe': ActorMethod<[string], [] | [UserInfo]>;
  'getLikedSongs': ActorMethod<[string], ResultStrings>;
  'likeSong': ActorMethod<[string, string], Result>;
  'unlikeSong': ActorMethod<[string, string], Result>;
  'getPlaylists': ActorMethod<[string], ResultPlaylists>;
  'createPlaylist': ActorMethod<[string, string], ResultNat>;
  'deletePlaylist': ActorMethod<[string, bigint], Result>;
  'addSongToPlaylist': ActorMethod<[string, bigint, string], Result>;
  'removeSongFromPlaylist': ActorMethod<[string, bigint, string], Result>;
}
export declare const idlService: IDL.ServiceClass;
export declare const idlInitArgs: IDL.Type[];
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
