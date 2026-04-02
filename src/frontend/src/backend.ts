/* eslint-disable */
// @ts-nocheck

import { Actor, HttpAgent, type HttpAgentOptions, type ActorConfig, type Agent, type ActorSubclass } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { idlFactory, type _SERVICE } from "./declarations/backend.did";

export interface Some<T> { __kind__: "Some"; value: T; }
export interface None { __kind__: "None"; }
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

  // Scaffold method (may not exist at runtime)
  _initializeAccessControlWithSecret?(secret: string): Promise<void>;
}

export class ExternalBlob {
  _blob?: Uint8Array<ArrayBuffer> | null;
  directURL: string;
  onProgress?: (percentage: number) => void = undefined;

  private constructor(directURL: string, blob: Uint8Array<ArrayBuffer> | null) {
    if (blob) { this._blob = blob; }
    this.directURL = directURL;
  }

  static fromURL(url: string): ExternalBlob {
    return new ExternalBlob(url, null);
  }

  static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob {
    const url = URL.createObjectURL(new Blob([new Uint8Array(blob)], { type: 'application/octet-stream' }));
    return new ExternalBlob(url, blob);
  }

  public async getBytes(): Promise<Uint8Array<ArrayBuffer>> {
    if (this._blob) return this._blob;
    const response = await fetch(this.directURL);
    const blob = await response.blob();
    this._blob = new Uint8Array(await blob.arrayBuffer());
    return this._blob;
  }

  public getDirectURL(): string {
    return this.directURL;
  }

  public withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob {
    this.onProgress = onProgress;
    return this;
  }
}

export class Backend implements backendInterface {
  constructor(
    private actor: ActorSubclass<_SERVICE>,
    private _uploadFile: (file: ExternalBlob) => Promise<Uint8Array>,
    private _downloadFile: (file: Uint8Array) => Promise<ExternalBlob>,
    private processError?: (error: unknown) => never
  ) {}

  async register(email: string, passwordHash: string) {
    return (this.actor as any).register(email, passwordHash);
  }

  async login(email: string, passwordHash: string) {
    return (this.actor as any).login(email, passwordHash);
  }

  async logout(token: string) {
    return (this.actor as any).logout(token);
  }

  async getMe(token: string): Promise<UserInfo | null> {
    const result = await (this.actor as any).getMe(token);
    // Candid returns Opt as [] | [UserInfo]
    if (Array.isArray(result)) {
      return result.length > 0 ? result[0] : null;
    }
    return result ?? null;
  }

  async getLikedSongs(token: string) {
    return (this.actor as any).getLikedSongs(token);
  }

  async likeSong(token: string, videoId: string) {
    return (this.actor as any).likeSong(token, videoId);
  }

  async unlikeSong(token: string, videoId: string) {
    return (this.actor as any).unlikeSong(token, videoId);
  }

  async getPlaylists(token: string) {
    return (this.actor as any).getPlaylists(token);
  }

  async createPlaylist(token: string, name: string) {
    return (this.actor as any).createPlaylist(token, name);
  }

  async deletePlaylist(token: string, playlistId: bigint) {
    return (this.actor as any).deletePlaylist(token, playlistId);
  }

  async addSongToPlaylist(token: string, playlistId: bigint, videoId: string) {
    return (this.actor as any).addSongToPlaylist(token, playlistId, videoId);
  }

  async removeSongFromPlaylist(token: string, playlistId: bigint, videoId: string) {
    return (this.actor as any).removeSongFromPlaylist(token, playlistId, videoId);
  }

  async _initializeAccessControlWithSecret(_secret: string): Promise<void> {
    // No-op: this app uses token-based auth, not Internet Identity RBAC
  }
}

export interface CreateActorOptions {
  agent?: Agent;
  agentOptions?: HttpAgentOptions;
  actorOptions?: ActorConfig;
  processError?: (error: unknown) => never;
}

export function createActor(
  canisterId: string,
  _uploadFile: (file: ExternalBlob) => Promise<Uint8Array>,
  _downloadFile: (file: Uint8Array) => Promise<ExternalBlob>,
  options: CreateActorOptions = {}
): Backend {
  const agent = options.agent || HttpAgent.createSync({ ...options.agentOptions });
  if (options.agent && options.agentOptions) {
    console.warn("Detected both agent and agentOptions. Ignoring agentOptions.");
  }
  const actor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
    ...options.actorOptions,
  });
  return new Backend(actor, _uploadFile, _downloadFile, options.processError);
}
