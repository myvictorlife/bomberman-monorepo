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

Env: `PORT` (default 8086), `HOST` (the interface to listen on, or `"host"` in
`config/game-server.json`; all of them when unset — set `127.0.0.1` when a
tunnel on the same machine publishes the server), `FIREBASE_PROJECT_ID` (falls back to
`config/firebase.json`), `DATA_DIR` (default `.data/game-server`, git-ignored),
`OUTSIDERS` (how many of the queue stand outside during a round; default 5,
`0` for none).
`ADMINS` (comma-separated e-mails allowed to change the room's rules from
the page; otherwise the `admins` array of `config/game-server.json`).
Without a project id nobody can sign in, but guests still play (below):
the ranking stays empty, since only accounts are counted.

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
- `dropItems` (on in the public room) is the scavenger rule: whoever falls —
  by flame, by leaving or by standing idle — leaves what they picked up
  scattered over free floor (`scatter.ts` in `game-core`), never on the cell
  they fell on, where an outsider steps in. Never in a stage.

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
- **Leaving after the round**: a player of the round in progress (or of
  the one just decided) sends `round:leave-after { leave }`
  (`parseLeaveAfterRound`; `leave: false` takes it back).
  `Lobby.leaveAfterRound` keeps them playing it out, then
  `requeuePlayers` leaves them out of the line; a winner who leaves gives
  the seat up (no champion). The snapshot's `leavingAfter` lists them; the
  queue panel shows "Leave after this round" / "Keep playing".
- **Bots** (`rules.bots`, 5 in the public room, `0` off). With nobody
  queued, `Lobby.update(now, watched)` runs the countdown anyway while
  anyone is connected and the round starts with that many bots; nobody
  connected, the room stays idle. With people queued, bots fill the round up
  to `rules.botsFillTo` players (3 in the public room: one person plays two
  bots, two play one, three or more none; `0`: bots never join people) —
  `botsFor(rules, people)` in `game-protocol` is the one formula. A round
  of bots alone ends the moment people queue (`Lobby.update` drops it back
  to the countdown; the room sees the lobby leave `playing` and drops the
  game), so a newcomer plays their own round instead of the border; a round
  with people in it always runs its course. One
  person is then enough for the countdown (`peopleNeeded(rules)`, also what
  the page shows). Bot seats are made per round
  by the lobby (`bot: true`, ids `cpu1…` — `isBotId`, names drawn from
  `BOT_NAMES`, never twice nor like a person in the round), never requeued,
  never champion. The room plays them with a `BotDirector`
  (`@libs/game-ai`) at the room's `rules.botLevel` — 1 easy, 2 medium
  (default), 3 hard, an admin rule like the others; `ROOM_BOT_LEVELS` in
  `game-protocol` maps it to the AI's `easy`, `casual` (a notch under
  `/play`'s medium, and not offered there) and `hard` — and merges its
  inputs before `tick`. A saved `rules.json` without it keeps medium. A bot runs inside the server with no lag, so `casual` is slowed
  to an online player's pace: it notices a bomb only after `reactionTicks`
  (45, ~0.75 s — a network trip plus a human reaction; its own bombs it
  always knows), runs for a random nearby refuge `slipChance` (25%) of the
  time, and does not read chains. Tune it in `levels.ts`; the tournament
  spec keeps easy < casual < medium < hard.
  `tick`. A round goes into the records only with `ACCOUNTS_TO_RANK` (2)
  accounts (`countsForRanking`, shared with the page's "Ranked / Friendly"
  badge); `/status` and `Lobby.people()` count people — guests included.
- **Guests** play without an account. `guest { name, token? }`
  (`parseGuest`: the profile's name rules) is answered with
  `guest { id, name, token }` — the id is `guest:<uuid>` (`isGuestId`;
  Firebase uids never hold a colon), the token is the guest's secret. The
  page keeps `{ name, token }` in `sessionStorage` and sends it again on a
  reload or a new socket, so the same guest gets their place back within
  the reconnect grace; a guest with no place and no connection is
  forgotten. A name an account's record or another guest has (`nameKey`) is
  `name-taken`. A guest queues and plays like anyone, but never writes in
  the chat (`auth-required`), never gets a record, and is never counted for
  the ranking. At most `GUESTS_PER_ADDRESS` (3) guests from one address hold
  a place at once (`guest-limit`); the address is `CF-Connecting-IP` behind
  Cloudflare, else what Colyseus resolves (`clientAddress`, read in
  `onAuth`) — spoofable without a proxy in front, so a soft limit. `hello`
  on a guest's connection ends the guest (their place goes with it);
  `guest` on a signed-in connection is `bad-message`.

- **Idle rule** (`rules.idleMs`, 30 s public, `0` off): `kickIdle` runs
  every tick for people in the round (`lastInputAt`, set on every input and
  at round start); past the limit they are eliminated (`eliminatePlayer`),
  left out of the line, told `error: idle`, and the chat gets an `idle-out`
  event. Bots and outsiders are not checked.

## The stages room (`/online/stages`)

A second public room, `STAGES_ROOM` (`stages`), runs beside the versus
`arena`: the campaign's stages played as a team. It is the same
`createArenaRoom` with `STAGES_ROOM_RULES` (`mode: 'stages'`), created at
boot by `main.ts`; its rules are fixed (no admin panel, nothing saved).
The page is the `/online` component, told its room by the `ONLINE_ROOM`
token the route provides; the store keeps a reconnection token per room
(`sessionTokenKey`).

- **Mode.** `RoomRules.mode` is `versus` or `stages`. It is not a
  `RULE_FIELDS` entry: `parseRules` keeps the room's own mode and refuses
  another.
- **Who plays.** One person starts the countdown (60 s); up to
  `STAGE_TEAM_SIZE` (4) play. No outsiders, no bots, no winner who stays, no
  ranking. The idle rule still applies.
- **Host.** First of the round being played, else first in line
  (`Lobby.hostId`). Only the host sends `stage:pick { stageId }` (among
  the stages their campaign has open — `stage-locked` otherwise) and
  `queue:start` (start now with whoever is in line). Anyone else gets
  `not-host`. A new host starts from where they are in the campaign.
- **Campaign.** `queue:join` may carry the browser's `campaign`. The room
  merges it with the account's record (`mergeProgress`: the record's lives,
  kit and points, every stage either side cleared); a guest's lives only in
  memory. Each seat starts the stage with its campaign's kit and lives
  (`PlayerSetup.lives`: a long stage spends them on falls).
- **End of a stage.** `Lobby.finishStage` moves every player's campaign on
  (`progressAfterStage`): cleared counts for everyone who played it — one
  who fell goes on with the starting kit — and a loss costs each a life. The
  room saves accounts' campaigns on their record (`recordStage`, sent back
  in `profile.campaign`), announces `stage-cleared` / `stage-failed`, and the
  team goes back to the front of the line, host first, on a short
  countdown (`STAGE_CONTINUE_MS`, 10 s). The next stage is the host's next
  one (`nextStageFor`): the same after a loss, the area's first after the
  host's game over. The page writes my campaign back to this browser's
  `campaign-progress`, so the campaign map agrees.
- **Snapshot.** `LobbySnapshot.stage` carries the stage, the host, the
  host's choices and each player's campaign; `null` in a versus room.
- **Game rules** (`game-core`, so `/campaign/play` gets them too): a
  teammate's flame never hurts in a stage — one's own still does — and the
  gate stays open `EXIT_GRACE_TICKS` (5 s) after the first one through, then
  shuts: whoever is still inside is left behind (`player-left-behind`) and
  loses their kit.
- **Long stages** (Área 2, `Stage.layout` + `Stage.parts`): the arena is
  wider than the screen. `StageRun.view` is the first column in play; only
  `VIEW_COLS` (15) exist for anyone, past them `tileAt` reads wall
  (`view.ts`). The view follows the team forward only, pulls a straggler
  after 3 s, and on a `survive` part runs on by itself with a burning edge.
  Each part's gate is the view's limit until its goal is met (`parts.ts`);
  arcs, breakers, cables and generators live in `fixtures.ts`. A fall spends
  a life and respawns on the left edge; with none left a helmet waits for a
  teammate. The whole `GameState` still goes out every frame, so the camera
  is the same for everyone — but `publicState` keeps `hiddenPowerUps` (what
  every block hides) on the server.

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
  focus, so typing in the chat never moves the player. They come back on a
  click or tap on the canvas (the scene blurs the field itself, since Phaser
  cancels the pointer's default action) or on Escape in the chat box, which
  stops there rather than leaving full screen; the box shows that hint
  while it has focus (`chat-typing`).
- Both hands always drive you online (`ONLINE_CONTROLS`: WASD and the
  arrows). The keyboard choice in `@libs/controls-settings` only matters
  on `/play`, where player 1 takes the chosen hand and a second player the
  other — alone, both.
- **Reconnection.** The store never gives up a dropped socket: it retries
  with a doubling pause (`reconnectDelay`, 1–30 s), at once on
  `visibilitychange`/`online` or the button, and after `RESTART_RETRY_MS`
  when the room broadcast `server:restarting` (`onBeforeShutdown`, 300 ms
  before `disconnect()`). It passes the connection's reconnection token
  (`ArenaConnection.token`, also in `sessionStorage` under
  `online.session`, never logged or in a URL) and `connectToArena` tries
  `client.reconnect(token)` before a fresh `join`. Server side, `onLeave`
  gets the close code: a drop (not `CloseCode.CONSENTED`) of a player or
  guest awaits `allowReconnection(client, RECONNECT_GRACE_MS)` (60 s) and,
  when they are back, `welcome`s them again — identity, queue spot or seat
  kept, no `hello`. A reserved seat counts toward `maxClients` (500) for
  the grace. Consented leaves keep the timer-based grace for a reload that
  says hello on a new session. Pings: 5 s apart, 3 misses.
- `OnlineStore` is provided on the route, but Angular keeps a route's
  providers — the store and its socket — alive across visits. So `connect`
  always leaves the store's previous connection first, and the page calls
  `store.disconnect()` in its `DestroyRef` hook: one socket per store, and
  no watcher counted after leaving. (Two sockets on one store fed the same
  frame listeners, ticks ran backwards and the arena remounted on every
  frame — the "flicker on return" bug.)
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

### Input: keys and the on-screen controller

- `ArenaScene` keeps one `DirectionTracker` per player; the keys of a
  `ControlScheme` feed it and `session.pressBomb/Ability/Detonate` fire on
  key down. `ArenaHandle.controller(playerId)` is a `PlayerController`
  (`press`, `release`, `clear`, `bomb`, `ability`, `detonate`) over the
  same tracker, safe to ask for before the scene has booted — what a touch
  controller drives. Keys and touch on one player share the tracker, so
  the last one pressed wins either way.
- `/play` has the controller already: `lib-virtual-gamepad` (`@libs/ui`,
  a D-pad resolved by `dragDirection` plus bomb/ability/detonate buttons)
  laid over a full-screen game mode (`play--game`, fixed over the page at
  `--z-modal`). A touch screen — `(pointer: coarse)` or the first touch
  pointer — goes straight to game mode behind "tap to play" and drops the
  second keyboard player. `/online` does the same once expanded on a touch
  screen (`online__layout--touch`/`--sideways`, the controller on
  `ONLINE_CONTROLS[0]`'s tracker, the chat hidden meanwhile; joining the
  queue expands). Held upright it turns the whole game sideways by
  CSS (`play--sideways`): full screen is asked of `document.documentElement`,
  never of the page element, because a full-screen element gets the
  browser's `transform: none !important`. Phaser's `autoCenter` is off —
  the host centres the canvas (`::ng-deep canvas { inset: 0; margin: auto }`)
  — and the host's `getBoundingClientRect` is swapped while sideways, since
  Phaser measures the parent through the turn. Both layouts sit above the
  site header, since an iPhone refuses the Fullscreen API.

## HTTP routes

The socket and a few plain routes share the port (`http.createServer` handed
to `WebSocketTransport({ server })`, handler in `apps/game-server/src/http.ts`).
**One request listener answers.** Colyseus binds its own listener (matchmaking,
`/__healthcheck`, a default `/`) to that server when it listens; `main.ts`
then takes the listeners over and runs `httpHandler` first, passing on
whatever it returns `false` for. A handler that writes to a request Colyseus
also answers throws `ERR_HTTP_HEADERS_SENT` and kills the process — so claim
a path, or leave it alone, never 404/405 the rest.

**Matchmaking joins, never creates.** `main.ts` creates the one public room
and sets `matchMaker.controller.exposedMethods` to `join`, `joinById` and
`reconnect`; the room also refuses a second instance of itself. It never
disposes itself, so a client-created room would tick forever. The browser
joins with `join(ARENA_ROOM)` — ship a client change before the server that
expects it.

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
application" route → `http://127.0.0.1:8086`, and the server runs with
`HOST=127.0.0.1`, so nothing on the network reaches it past the tunnel;
Cloudflare proxies WebSockets by default). `hosting/firebase.json` already lists that origin in `connect-src`.
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
