/* eslint-disable */
// @ts-nocheck
import { IDL } from '@icp-sdk/core/candid';

const AuthResult = IDL.Variant({ 'ok': IDL.Text, 'err': IDL.Text });
const Result = IDL.Variant({ 'ok': IDL.Null, 'err': IDL.Text });
const ResultNat = IDL.Variant({ 'ok': IDL.Nat, 'err': IDL.Text });
const ResultStrings = IDL.Variant({ 'ok': IDL.Vec(IDL.Text), 'err': IDL.Text });

const PlaylistInfo = IDL.Record({
  'id': IDL.Nat,
  'name': IDL.Text,
  'videoIds': IDL.Vec(IDL.Text),
});
const ResultPlaylists = IDL.Variant({
  'ok': IDL.Vec(PlaylistInfo),
  'err': IDL.Text,
});

const UserInfo = IDL.Record({
  'id': IDL.Nat,
  'email': IDL.Text,
  'username': IDL.Text,
});

export const idlService = IDL.Service({
  'register': IDL.Func([IDL.Text, IDL.Text], [AuthResult], []),
  'login': IDL.Func([IDL.Text, IDL.Text], [AuthResult], []),
  'logout': IDL.Func([IDL.Text], [Result], []),
  'getMe': IDL.Func([IDL.Text], [IDL.Opt(UserInfo)], ['query']),
  'getLikedSongs': IDL.Func([IDL.Text], [ResultStrings], ['query']),
  'likeSong': IDL.Func([IDL.Text, IDL.Text], [Result], []),
  'unlikeSong': IDL.Func([IDL.Text, IDL.Text], [Result], []),
  'getPlaylists': IDL.Func([IDL.Text], [ResultPlaylists], ['query']),
  'createPlaylist': IDL.Func([IDL.Text, IDL.Text], [ResultNat], []),
  'deletePlaylist': IDL.Func([IDL.Text, IDL.Nat], [Result], []),
  'addSongToPlaylist': IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
  'removeSongFromPlaylist': IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
});

export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const AuthResult = IDL.Variant({ 'ok': IDL.Text, 'err': IDL.Text });
  const Result = IDL.Variant({ 'ok': IDL.Null, 'err': IDL.Text });
  const ResultNat = IDL.Variant({ 'ok': IDL.Nat, 'err': IDL.Text });
  const ResultStrings = IDL.Variant({ 'ok': IDL.Vec(IDL.Text), 'err': IDL.Text });
  const PlaylistInfo = IDL.Record({
    'id': IDL.Nat,
    'name': IDL.Text,
    'videoIds': IDL.Vec(IDL.Text),
  });
  const ResultPlaylists = IDL.Variant({
    'ok': IDL.Vec(PlaylistInfo),
    'err': IDL.Text,
  });
  const UserInfo = IDL.Record({
    'id': IDL.Nat,
    'email': IDL.Text,
    'username': IDL.Text,
  });
  return IDL.Service({
    'register': IDL.Func([IDL.Text, IDL.Text], [AuthResult], []),
    'login': IDL.Func([IDL.Text, IDL.Text], [AuthResult], []),
    'logout': IDL.Func([IDL.Text], [Result], []),
    'getMe': IDL.Func([IDL.Text], [IDL.Opt(UserInfo)], ['query']),
    'getLikedSongs': IDL.Func([IDL.Text], [ResultStrings], ['query']),
    'likeSong': IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'unlikeSong': IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'getPlaylists': IDL.Func([IDL.Text], [ResultPlaylists], ['query']),
    'createPlaylist': IDL.Func([IDL.Text, IDL.Text], [ResultNat], []),
    'deletePlaylist': IDL.Func([IDL.Text, IDL.Nat], [Result], []),
    'addSongToPlaylist': IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
    'removeSongFromPlaylist': IDL.Func([IDL.Text, IDL.Nat, IDL.Text], [Result], []),
  });
};

export const init = ({ IDL }) => { return []; };
