---
name: game-server
description: The Node + Colyseus game server (apps/game-server), the online room (/online), the lobby rules and the wire protocol. Use when changing how the queue, countdown, rounds, ranking or player records work, when adding a server message, when running or deploying the server, or when e-mail sign-in for the online room fails.
---

# Skill: Game server and online room

## The pieces

| Project                 | Path                 | What lives there                                                                                                                                           |
| ----------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game-server`           | `apps/game-server`   | Colyseus bootstrap (`main.ts`), the room glue (`arena-room.ts`), token check (`auth.ts`), JSON records file (`records-store.ts`), env config (`config.ts`) |
| `game-protocol`         | `libs/game/protocol` | Message names, payload types, `PUBLIC_ROOM_RULES`, validators for untrusted input, frame rate                                                              |
| `game-lobby`            | `libs/game/lobby`    | `Lobby` (queue + countdown state machine) and player records (`recordVisit`, `recordRound`, `ranking`, `toProfile`)                                        |
| `game-core`             | `libs/game/core`     | The rules, unchanged — the server ticks the same `tick()` the browser does                                                                                 |
| `game-client`           | `libs/game/client`   | `OnlineSession` (mirrors server frames, interpolates players), `connectToArena` (the only file that imports `@colyseus/sdk`, dynamically)                  |
| `online`                | `libs/online`        | The `/online` page, `OnlineStore`, account/queue/ranking molecules                                                                                         |
| `auth`, `auth-firebase` | `libs/shared/auth*`  | `AUTH` contract and the Firebase implementation (e-mail/password, Google)                                                                                  |

**Where a change goes:** a rule about who plays when → `Lobby`; a new number
the browser shows → `game-protocol` type + `arena-room.ts` send + store; a rule
of the game itself → `game-core` (both local and online get it).

## Running it

```sh
npm run start:server     # nx serve game-server, rebuilds on change, port 8086
npm start                # the app; dev builds connect to http://localhost:8086
```

Env: `PORT` (default 8086), `FIREBASE_PROJECT_ID` (falls back to
`config/firebase.json`), `DATA_DIR` (default `.data/game-server`, git-ignored),
`OUTSIDERS` (how many of the queue stand outside during a round; default 5,
`0` for none).
`ADMINS` (comma-separated e-mails allowed to change the room's rules from
the page; otherwise the `admins` array of `config/game-server.json`).
Without a project id the room is **watch-only**: nobody can sign in to queue.

The browser finds the server through `environment.gameServerUrl`, generated
from `config/game-server.json` (`{ "url": "https://…" }`) or `GAME_SERVER_URL`.
Production builds without it show "online not available" instead of failing.

### Restarting the live server

SIGTERM saves the records and exits within 3 s. Restart only when no round is
in progress (`phase` is `waiting`, `countdown` or `results`), and match the
process precisely — a script whose own command line contains
`dist/apps/game-server/main.js` gets killed by a plain `pkill -f` of it:

```sh
pkill -TERM -f '^node dist/apps/game-server/main.js'
node dist/apps/game-server/main.js &        # then check: lsof -i :8086 -sTCP:LISTEN
```

## Room rules (`PUBLIC_ROOM_RULES`)

`RoomRules` is the room's set of feature flags. The defaults are
`PUBLIC_ROOM_RULES`; what an admin last set is saved to `rules.json` under
`DATA_DIR` and wins at boot (then `OUTSIDERS` only matters until the page is
used once). **Adding a rule:** a key in `RoomRules` with its default, one
entry in `RULE_FIELDS` (the values offered — a rule never takes a free
value), `ONLINE.RULES.<KEY>` + `<KEY>_DESC` in `en` and `pt`, and the code
that reads it (the room passes the round's rules to `createGame`). The panel
on `/online` draws itself from the schema; `parseRules` validates a change.

- A signed-in account whose e-mail is in `admins` gets `admin { admin: true }`
  after `hello` and may send `rules:set { rules: Partial<RoomRules> }`;
  anyone else gets `forbidden`. A bad value is `bad-message`.
- Between rounds the change applies at once. During a round (and its results)
  `Lobby.setRules` holds it as `nextRules` — in the snapshot, so every page
  shows it coming — and swaps it in when the room goes back to `waiting`, so
  the border is never reseated mid-round and a round never changes length.
- `roundTimerMs` (0 = no clock) and `closingWalls` are the round's clock and
  spiral of falling walls (`game-core`), set per round in `refreshLobby`.

- Max 5 (four corners + the middle), min 2, countdown 15 s, results 5 s.
- Fifth player in line starts the round at once; the countdown never restarts
  when someone joins; it cancels below two.
- One place per account (Firebase uid), across tabs. When the last tab drops,
  the place is held for `RECONNECT_GRACE_MS` (15 s) so a reload carries on;
  after that, or at once on an explicit `sign-out`, the player leaves the
  queue or is eliminated from the round (`eliminatePlayer`), so a two-player
  round ends with the other as the winner. Leavers are not requeued.
- Online keys are always bound; `OnlineSession.setControls` decides whether
  they drive anyone. Never remount the arena to change control: destroying one
  Phaser game while another boots breaks the second one's keyboard.
- After a round, with `winnerStays` (the room's rule; default 5, `0` off):
  the winner goes **first** in line, so they play the next round with the
  next `maxPlayers - 1`, until that many wins in a row (`Lobby.champion`,
  in the snapshot as `champion { id, streak }`). Then those already waiting,
  then the round's other players, best placed first — the room passes
  `standings(game)` (winner, still standing, last to fall) to
  `finishRound`. A draw, a winner who left, or the rule off: everyone to the
  back, winner first among them. The chat says `champion-stays` /
  `champion-limit` (or `round-won` with the rule off).
- **Outsiders** (`rules.outsiders`, 5 in the public room; `OUTSIDERS` env on
  the server, `0` turns it off): while a round is played, the first that
  many in line stand on the border wall (`state.outsiders`), walk it and throw
  bombs in with the bomb key. A kill from outside puts the thrower in the
  round (`outsider-entered` event → `Lobby.enterRound`, then they go to the
  back with the players); the next in line steps out. The room keeps the
  border in step with the queue after every lobby change (`syncOutsiders`).
  The rules of throwing and entering live in `libs/game/core/src/lib/outsiders.ts`
  (the flight and the landing, shared with the glove and the kick, in `throw.ts`)
  and `game.ts`; who stands there is the lobby's call.
- Frames carry `round`: the browser keys the arena by it, never by the
  players, because an entry adds a player mid-round.

## Chat and reactions

`Chat` in `@libs/game-lobby` holds every limit; the room only passes messages
through. **Nothing is stored on disk**: the room keeps the last
`CHAT_HISTORY` (50) messages in memory, a newcomer gets the last
`CHAT_BACKLOG` (20) no older than `CHAT_MAX_AGE_MS` (10 min), and a restart
forgets all of it, along with who was silenced.

- Writing (`chat:send { text }`) takes a signed-in account with a confirmed
  e-mail; up to `CHAT_MAX_LENGTH` (140) characters, control and invisible
  characters flattened (`parseChatText`). One message per 2 s, 5 per 15 s,
  and the same text again within 30 s is refused — all as `chat-slow-down`.
- Each line carries the author's role when it was written (`playing`,
  `queued`, `watching`). The room announces `round-won`, `round-draw` and
  `outsider-entered` as lines with no author; the page translates them.
- Reactions (`react { emoji }`, one of `REACTIONS`) come from anyone,
  signed in or not, 4 per 3 s per sender, and are never kept.
- An admin sends `chat:delete { id }` or `chat:mute { accountId }` (which
  also removes what the account wrote); everyone gets `chat:removed { ids }`.
- The arena stops reading (and swallowing) keys while a text field has
  focus, so typing in the chat never moves the player.
- On the page the chat is the first card beside the arena. The stage's
  corner button (`online-expand`) sets `expanded`: the layout goes
  `position: fixed` with the arena filling the screen and the chat docked
  on the right (`lib-chat-panel [dock]`), the other cards hidden, and the
  browser's Fullscreen API asked for where it exists. Escape and the
  browser's own `fullscreenchange` both collapse it. The DOM never moves,
  so the Phaser canvas stays mounted and re-fits itself.
- The round's clock and `lib-players-panel [compact]` (who is in, with
  what) are a strip over the top of the stage (`online-hud`), fed by the
  arena's `onHud` snapshot — not a sidebar card.
- Wide screens get three columns (`grid-template-areas`): the ranking on
  the left (`online-ranking`: the shared `lib-podium` for the top three,
  painted with `paintCartoonCharacter`, then `lib-ranking-list` from
  fourth place), the arena, the room's cards. The expanded layout hides
  the ranking column.

## HTTP routes

The socket and a few plain routes share the port (`http.createServer` handed
to `WebSocketTransport({ server })`, handler in `apps/game-server/src/http.ts`).
**One request listener answers.** Colyseus binds its own listener (matchmaking,
`/__healthcheck`, a default `/`) to that server when it listens; `main.ts`
then takes the listeners over and runs `httpHandler` first, passing on
whatever it returns `false` for. A handler that writes to a request Colyseus
also answers throws `ERR_HTTP_HEADERS_SENT` and kills the process — so claim
a path, or leave it alone, never 404/405 the rest.

- `GET /ranking` — the top 10 as JSON (`RankingEntry[]`, with each player's
  last `characterId`), `Access-Control-Allow-Origin: *`, cached 30 s. The
  title screen's podium reads it; add a route there, never a second server.
- `GET /status` — `RoomStatus` (online, phase, playing, queued), cached 5 s,
  from the room's listing metadata (`setMetadata` in `refreshLobby`). The
  title screen's presence pill reads it.
- `GET /me` / `PUT /me` — the signed-in player's own profile (`me.ts`), for
  the profile page, which has no socket. `Authorization: Bearer <ID token>`,
  checked like `hello`'s; `no-store`. `GET` answers `PlayerProfile` (creating
  the record on a first visit). `PUT` takes `ProfileUpdate`
  (`parseProfileUpdate`: `name`, `favoriteCharacterId`, `color` or `null`) —
  400 `bad-request`, 403 `email-not-verified`, 409 `name-taken`, else 200
  with the new profile. It saves through `records.putProfile`, which tells
  the room (`watchProfiles`): it re-sends the ranking, the player's profile,
  and gives their connections the new name. A seat already taken keeps the
  old one.
- `GET /` — 200, for the tunnel's health check.

## Player records

`PlayerRecord` (`records.ts` in `game-lobby`) is what `players.json` keeps per
account. `recordVisit` refreshes the name from the token on every `hello`
**unless `nameChosen`** — a name picked on `/me` sticks. `cleanRecord` keeps
only the record's own fields (a verified account carries the e-mail; it must
never reach the file), and `RecordsStore.load` cleans what older files hold.
The ranking's face is `favoriteCharacterId ?? characterId` (last played), and
it carries the player's `color`. Names compare by `nameKey` (no case, accents
or spaces) — that is the uniqueness rule.

**Colours.** A seat takes the colour on the player's record when they join
the queue (never from the message); `createGame` hands out colours with
`assignColors` — first in line keeps theirs, a later one gets the closest
free colour. A colour changed while queued applies from the next join.

## Auth

The client sends `hello { token }` with a fresh Firebase ID token
(`idToken(true)`, so a just-confirmed e-mail is seen). The server verifies it
with `jose` against Google's public keys — issuer and audience are the project
id, no service account. `email_verified: false` gets a profile but
`email-not-verified` on `queue:join`.

Firebase console prerequisites: **Authentication → Get started → Sign-in
method → Email/Password: enable.** Until then sign-up fails with
`auth/configuration-not-found` / `operation-not-allowed`, shown as
`ONLINE.AUTH_ERROR.unavailable`. The confirmation link returns to `/online`;
its domain must be in Authentication → Settings → Authorized domains
(`localhost` and the Hosting domains are there by default).

Google sign-in (`auth.signInWith('google')`) needs **Sign-in method →
Google: enable**, with a support e-mail. Google accounts arrive with
`email_verified: true`, so they skip the confirmation step and the server needs
no change. A provider left disabled, or a page on an unlisted domain, comes back
as `unavailable`; a closed popup as `cancelled`, which the page does not show.
On the `authDomain` the page leaves for Google and comes back (a redirect);
`initialize()` finishes it, and the page shows a failure from
`auth.takeRedirectError()`. Elsewhere (`localhost`) it is a popup. The hosting
headers it needs are in the `firebase-deploy` skill.

## Tests

- `nx test game-lobby`, `nx test game-protocol`: pure, 95% floors.
- `nx test game-server`: Vitest on Node (`apps/game-server/vitest.config.mts`),
  including `arena-room.spec.ts`, which boots a real Colyseus server with a
  fake token verifier and plays a round with SDK clients. The spec may import
  `@colyseus/sdk` behind an eslint-disable; server code may not.
- `nx test online`: the page with a `FakeConnection` and a fake launcher.

## Deploying

Current setup of this project: the server runs on the developer machine and a
Cloudflare Tunnel publishes it as `https://api.detona.online` ("Published
application" route → `http://localhost:8086`; Cloudflare proxies WebSockets by
default). `hosting/firebase.json` already lists that origin in `connect-src`.
A fork replaces that origin with its own.

General recipe:

Firebase Hosting cannot hold WebSockets. Build with
`nx build game-server --configuration=production` (outputs
`dist/apps/game-server/main.js` plus a `package.json` with the runtime deps),
run it on any Node host (Fly.io in São Paulo, a VPS, Cloudflare Tunnel), then:

1. Set `GAME_SERVER_URL` for the web build (or `config/game-server.json`).
2. Add the server's `https://` and `wss://` origins to `connect-src` in
   `hosting/firebase.json` — the CSP blocks it otherwise.
3. Give the server a persistent `DATA_DIR`, or swap `RecordsStore` for a database.
