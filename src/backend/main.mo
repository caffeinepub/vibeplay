import Int "mo:core/Int";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";

actor VibePlay {

  // ── Types ──────────────────────────────────────────────────────

  type UserId = Nat;

  type User = {
    id        : UserId;
    email     : Text;
    passHash  : Text;
    username  : Text;
  };

  type Session = {
    userId    : UserId;
    token     : Text;
    createdAt : Int;
  };

  type Playlist = {
    id       : Nat;
    userId   : UserId;
    name     : Text;
    videoIds : [Text];
  };

  type AuthResult = { #ok : Text; #err : Text };
  type Result     = { #ok; #err : Text };

  // ── Stable state (Map is natively stable) ─────────────────────

  var nextUserId     : Nat = 1;
  var nextPlaylistId : Nat = 1;

  let users     : Map.Map<Text, User>    = Map.empty();
  let sessions  : Map.Map<Text, Session> = Map.empty();
  let liked     : Map.Map<Nat, [Text]>   = Map.empty();
  let playlists : Map.Map<Nat, Playlist> = Map.empty();

  // ── Helpers ─────────────────────────────────────────────────────

  func makeToken(email : Text, ts : Int) : Text {
    email # Int.abs(ts).toText();
  };

  func getSession(token : Text) : ?Session {
    sessions.get(token);
  };

  func emailPrefix(email : Text) : Text {
    let parts = email.split(#char '@');
    let arr   = parts.toArray();
    if (arr.size() > 0) arr[0] else email;
  };

  func findUserById(uid : Nat) : ?User {
    var result : ?User = null;
    for ((_, u) in users.entries()) {
      if (u.id == uid) { result := ?u };
    };
    result;
  };

  func getLikedForUser(uid : Nat) : [Text] {
    switch (liked.get(uid)) {
      case (?ids) ids;
      case null   [];
    };
  };

  // ── Auth ────────────────────────────────────────────────────────

  public func register(email : Text, passHash : Text) : async AuthResult {
    if (email == "" or passHash == "") return #err "Email and password required";
    switch (users.get(email)) {
      case (?_) { #err "Email already registered" };
      case null {
        let id = nextUserId;
        nextUserId += 1;
        let user : User = { id; email; passHash; username = emailPrefix(email) };
        users.add(email, user);
        let token = makeToken(email, Time.now());
        sessions.add(token, { userId = id; token; createdAt = Time.now() });
        #ok token;
      };
    };
  };

  public func login(email : Text, passHash : Text) : async AuthResult {
    switch (users.get(email)) {
      case null { #err "No account found for this email" };
      case (?user) {
        if (user.passHash != passHash) return #err "Incorrect password";
        let token = makeToken(email, Time.now());
        sessions.add(token, { userId = user.id; token; createdAt = Time.now() });
        #ok token;
      };
    };
  };

  public func logout(token : Text) : async Result {
    sessions.remove(token);
    #ok;
  };

  public query func getMe(token : Text) : async ?{ id : UserId; email : Text; username : Text } {
    switch (getSession(token)) {
      case null { null };
      case (?sess) {
        switch (findUserById(sess.userId)) {
          case null { null };
          case (?u)  { ?{ id = u.id; email = u.email; username = u.username } };
        };
      };
    };
  };

  // ── Liked Songs ─────────────────────────────────────────────────

  public query func getLikedSongs(token : Text) : async { #ok : [Text]; #err : Text } {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) { #ok (getLikedForUser(sess.userId)) };
    };
  };

  public func likeSong(token : Text, videoId : Text) : async Result {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        let current = getLikedForUser(sess.userId);
        var found = false;
        for (v in current.values()) { if (v == videoId) { found := true } };
        if (not found) {
          liked.add(sess.userId, current.concat([videoId]));
        };
        #ok;
      };
    };
  };

  public func unlikeSong(token : Text, videoId : Text) : async Result {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        let current = getLikedForUser(sess.userId);
        liked.add(sess.userId, current.filter(func(v : Text) : Bool = v != videoId));
        #ok;
      };
    };
  };

  // ── Playlists ──────────────────────────────────────────────────

  public query func getPlaylists(token : Text) : async { #ok : [{ id : Nat; name : Text; videoIds : [Text] }]; #err : Text } {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        let result = playlists.values().toArray().filterMap(
          func(pl : Playlist) : ?{ id : Nat; name : Text; videoIds : [Text] } {
            if (pl.userId == sess.userId)
              ?{ id = pl.id; name = pl.name; videoIds = pl.videoIds }
            else null;
          },
        );
        #ok result;
      };
    };
  };

  public func createPlaylist(token : Text, name : Text) : async { #ok : Nat; #err : Text } {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        if (name == "") return #err "Playlist name required";
        let id = nextPlaylistId;
        nextPlaylistId += 1;
        playlists.add(id, { id; userId = sess.userId; name; videoIds = [] });
        #ok id;
      };
    };
  };

  public func deletePlaylist(token : Text, playlistId : Nat) : async Result {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        switch (playlists.get(playlistId)) {
          case null { #err "Playlist not found" };
          case (?pl) {
            if (pl.userId != sess.userId) return #err "Not your playlist";
            playlists.remove(playlistId);
            #ok;
          };
        };
      };
    };
  };

  public func addSongToPlaylist(token : Text, playlistId : Nat, videoId : Text) : async Result {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        switch (playlists.get(playlistId)) {
          case null { #err "Playlist not found" };
          case (?pl) {
            if (pl.userId != sess.userId) return #err "Not your playlist";
            var found = false;
            for (v in pl.videoIds.values()) { if (v == videoId) { found := true } };
            if (not found) {
              playlists.add(playlistId, { id = pl.id; userId = pl.userId; name = pl.name; videoIds = pl.videoIds.concat([videoId]) });
            };
            #ok;
          };
        };
      };
    };
  };

  public func removeSongFromPlaylist(token : Text, playlistId : Nat, videoId : Text) : async Result {
    switch (getSession(token)) {
      case null { #err "Not authenticated" };
      case (?sess) {
        switch (playlists.get(playlistId)) {
          case null { #err "Playlist not found" };
          case (?pl) {
            if (pl.userId != sess.userId) return #err "Not your playlist";
            playlists.add(playlistId, { id = pl.id; userId = pl.userId; name = pl.name; videoIds = pl.videoIds.filter(func(v : Text) : Bool = v != videoId) });
            #ok;
          };
        };
      };
    };
  };
};
