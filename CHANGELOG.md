# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because this is a template, "breaking" means _breaking for someone who forked it
and wants to pull updates_ — a renamed lib, a changed provider signature, a moved
config file. Ordinary app-level additions are minor.

## [Unreleased]

### Added

- **A fourth arena: the Núcleo.** The datacenter where CIDA, the city's AI,
  lives — the arena of Área 3. A circuit-board floor, server racks for
  pillars, glass data cubes for crates, a barrier with a light strip and a
  wall of data screens along the top with CIDA's eye in the middle (an extra
  wall on the top border, so the grid is the classic one). Its moment is the
  **sweep** (`ArenaMoment` kind `sweep`): every 30 s the eye turns red and a
  laser line runs down the arena in 2 s, visual only. A theme may paint a
  tile's red-alert look under `<key>:alarm`. Playable in versus and on
  `/arenas`; the area's stages come next.
- **Área 2 — Subestação.** Five stages: four long ones (31 or 61 columns,
  seen 15 at a time through a camera that follows the team forward only)
  split into parts, each behind a gate that opens on a goal — clear the
  critters, grab the key a critter carries, blow up the breakers of the arc
  lines, blow up the generators, or survive a screen that runs on by itself
  with a burning edge — and the boss, the **Gato de Fios** (a charged zap
  along its row and column that crates block, a pounce, two generators, a
  drained window after each zap, blackouts from half health, 7/10/14 hits
  by team size). A live arc line and the Gato's zap set off any bomb in
  their way, like a flame. New critters: faísca, gambá (plays dead), marimbondo (flies
  over crates) and curto (bursts when it falls). On a long stage a fall
  spends a campaign life and respawns on the screen's edge; with none left a
  helmet waits for a teammate to pick it up. New modules in `game-core`:
  `view.ts`, `parts.ts`, `fixtures.ts`, `gato.ts`; `Stage.layout`,
  `Stage.parts`, `ArenaLayout`, `PlayerSetup.lives`. A game-core change: the
  server and the site ship together.

- **Fallen players return from the border.** In a versus round, someone
  who falls goes to the border wall when the line leaves a place free, and a
  kill from there brings them back into the round in their own slot and
  colour — as often as they manage. The line keeps priority: someone joining
  it takes the place of whoever fell last. Bots stay down. A room rule,
  **`fallenOutside`** ("Fallen fight back from the wall", on by default in
  the public room), switches it off. `Lobby.fell` in `game-lobby`;
  `addOutsider`/`enterArena` in `game-core` accept a fallen player. The
  server builds each person's input once a tick, so a fallen player's bomb
  key throws from the wall. A game-core and server change: the server and the site ship
  together.

- **Outsiders show the bomb they are about to throw.** Whoever stands on
  the border holds a lit bomb up over their head — at their side on the top
  wall — while they may throw (no bomb of theirs out yet); it goes when they
  throw and comes back once that one has gone off. Client only.

### Security

- **Frames no longer carry what every block hides.** `publicState` (in
  `game-protocol`) drops `hiddenPowerUps` from every frame the server sends;
  only the server needs it.

- **Bot level in the online room.** A new room rule, "Bot level"
  (`botLevel`: 1 easy, 2 medium, 3 hard; medium by default, the level the
  room's bots already played at), on the admin panel with the other rules.
  `ROOM_BOT_LEVELS` in `game-protocol` maps it to the AI's `easy`, `casual`
  and `hard`. A rules file saved before it keeps medium. A server change:
  the server and the site ship together.

### Fixed

- **Back from the border with the right look.** Whoever re-entered the
  round had their slot repainted through the transform the first paint left
  on the canvas: a strip of the old head floated above them and the new
  sprite slid down, feet cut off. The repaint now draws in plain pixels.
- **A bomb set beside someone passing now blocks them.** Whoever merely
  brushed the bomb's cell when it was set could turn back and walk through
  it, because everyone overlapping the cell was let through. Now only whoever
  stands on it (centre in the cell, `standsOn` in `movement.ts`) may walk off
  it; anyone else walks on but cannot step deeper into the cell. Applies to
  set, dropped and landing bombs alike. A game-core change: the server and
  the site must be deployed together.

### Added

- **A Gestora Estressada joins the crew.** A second IT character (`gestora`),
  the software engineer who manages people and books every meeting: slate
  blazer over a team-coloured tee, a headset round her neck, a badge, a
  laptop under one arm and a tall glass mug of coffee. Drawn by the same
  cartoon painter as the rest of the cast, in every facing and pose.
- **Sign in and out from the header.** With sign-in configured, the header's
  "Play" button becomes "Sign in" (Google in one click, or e-mail on the
  profile page); signed in, it shows the player's initial and name, with the
  profile, a nudge to confirm the e-mail, and "Sign out". The mobile menu
  carries the same choices at the top. The nav's "Play" link reads
  "Online", and "Profile" moves into the account menu. A fork without
  sign-in keeps the old button. The profile page now signs a visitor in
  itself instead of sending them to `/online`.
- **`@libs/account`** (`scope:account-lib`): `AccountService`, the shared
  sign-in state (`start()` restores the session after the first paint and
  reads a returning redirect's failure once), and `AccountPanelComponent`,
  moved here from `@libs/online`. The header gets a `HeaderAccount` input
  and stays presentational; the app shell composes the two.
- **Stages together, online.** A second public room on the game server,
  `/online/stages`, plays the campaign's stages as a team of up to four.
  The first in line hosts: picks the stage among those their campaign has
  open, and either waits for friends or presses "Start now". No friendly
  fire, no bots, no ranking. Clear a stage and the team stays together for
  the next one; lose it and everyone loses a life. Each account's campaign
  is kept on its server record, merged with what the browser cleared alone,
  and written back to the browser. The campaign page links to it ("Play
  with friends online").
- **The gate waits for the team.** In a stage, the gate stays open five
  seconds after the first player goes through, then shuts; whoever is still
  inside is left behind without their kit. A teammate's flame no longer
  hurts in a stage.
- **Game feel.** A blast holds the arena for two frames and flashes white
  for its first instant (a fifth flame frame); a crate's chips fly out,
  drop and bounce on the floor; a bomb pulses harder and faster as the fuse
  burns, sheds sparks, and ticks through its last second; whoever is hit
  flashes white and falls onto their back with sparks circling, instead of
  spinning away; standing next to a bomb about to go, a player is scared
  (eyes wide, mouth open, hands up — a sixth pose, drawn by every
  character), and trembles. Standing still for two seconds, a player
  starts to fidget: weight from one foot to the other, a sway, every two
  and a half seconds. Sound effects drift a little in pitch, so no two
  bombs sound the same; the sounds page lists the fuse tick.
- **The scenery is lit like the cast.** Every solid tile of every arena —
  walls, border, features, crates — gets a top-left highlight, a
  bottom-right core shadow following its shape and a near-black silhouette
  (`relief` in `themes/theme.ts`, applied by the tile painters). Power-ups
  glow softly and pulse. A mount waiting with its rider is alive: its two
  idle moments (a chew, a blink, a wag) cycle slowly.

### Changed

- **The next stage comes sooner.** In the online stages room the team's
  countdown between two stages is 5 s instead of 10 (`STAGE_CONTINUE_MS`).
- **A quicker start.** The HD skin paints a slot's riding frames the first
  time that slot climbs on a mount (`ArenaSkin.loadMount`), instead of
  every slot on every mount before the first frame: the skin's start-up
  paint dropped from about 590 ms to under 40 ms. The renderer shows the
  rider on foot for the one frame before the mount's look is ready.

### Fixed

- **A new round no longer starts with a giant player.** The bomb-setting
  pose kept the tick of the last bomb from the previous round; with the
  clock back at zero the squash went huge. The arena now forgets what it
  remembered of a round when the clock goes back.

### Added

- **Room for the arena on a phone.** In game mode a 📊 button beside 🎮
  hides the strip with the clock and the players, on `/play`, `/online`
  and a stage alike, and the choice is remembered on the browser
  (`play.strip-hidden`, shared by the three pages). On a phone held
  upright the strip is the column beside the arena, so hiding it gives
  the arena the width back.
- **The cast acts.** Two poses join the standing frame and the two steps:
  setting a bomb down (crouched, hands low, held for a quarter second with
  a squash that springs back) and the winner's cheer (arms up, a knee up,
  hopping on the spot from the moment the round is decided). Standing still,
  a player breathes. Every character draws both poses in all four facings;
  the classic pixel skin reuses its standing frame for them.

### Changed

- **The cast has volume.** Every character and mount, and the egg, are
  drawn with new helpers in `ink.ts`: a top-left light with a highlight and
  a core shadow on every shape (`volume`, `band`), lines in each material's
  own colour (`lineOf`) with the near-black line kept for the silhouette
  only (`rimLight` now draws it before the pale rim), contact shadows under
  a brim, a chin or a hem (`occlude`), gloss (`gloss`) and seams (`seam`).
  Novato, the pilot, also got socks, soles, laces, brows, a tongue, blush,
  a thumb on each hand and hair at the nape; everyone but Byte got eyes with
  a sclera and a glint. The egg is big in its cell, with green-teal
  continents outlined in their own line, pink speckles and chips that lift
  as it cracks.

### Added

- **A sound switch on the online page.** A speaker button at the right of
  the round's strip, above the arena, turns the effects off and on
  mid-round, for the arena on screen and for every round after it. It is
  the same choice the settings page keeps, so it survives a reload and
  applies to the offline pages too.

### Changed

- **The cast reads like an arena cartoon.** Every character is drawn with
  the same proportions, applied by two shared frames in `ink.ts` instead of
  redrawn per painter: a body a quarter wider than before, a head a third
  bigger about the neck, and a thicker default ink. On-foot frames now have
  headroom above the cell, like mounted ones, so the head overlaps the row
  above as in a 3/4 view; outsiders on the border stand on their cell the
  same way. Mounts are drawn as a block — wider from the front and the back,
  taller about their feet — and carry a rider nearly the size it is on foot.
  Every figure, in the arena and on the pages, gets a pale rim behind its
  dark outline so it stands out on a dark floor.

### Added

- **Sharp character previews.** `paintCharacterFrame` and `paintMountIcon`
  take the side they are shown at (`size`, in CSS pixels) and paint that many
  pixels times the screen's pixel ratio, scaling the context so the painters
  keep drawing in 64 units. The roster, the mounts page and every sprite card
  pass their size, so a big preview on a dense screen is no longer a 64 px
  canvas stretched by CSS.
- **Fallen players drop their items.** A new room rule, "Fallen players drop
  items" (`dropItems`, on in the public room and in versus by default):
  whoever falls leaves everything above the starting kit scattered over free
  floor — one item per level, full fire as itself, a curse still running as
  its skull; the vest and the clock are spent, a mount is gone already.
  Never in a stage, where the kit carries on. The online room and versus now
  also hide wall pass, full fire, power bomb, skull (two) and clock; the extra
  life stays stage-only.
- **A stage plays on a phone like `/play`.** On a touch screen the stage
  opens behind "tap to play", then fills the screen with the on-screen
  controller over it; held upright the whole game turns a quarter to play
  sideways, with 🔄 to stay upright (the same remembered choice as `/play`),
  🎮 to hide the controller and ⛶ / ✕ to enter and leave game mode on any
  screen. A strip over the arena shows the stage, lives, points, clock,
  creatures, the gate, the boss's health and the kit. The browser chores of
  game mode — full screen, orientation lock, the turned host's measurements,
  the upright choice — are now shared in `@libs/ui` (`game-screen.ts`);
  `/play` and `/online` still carry their own copies.
- **The stages are played signed in.** On the campaign map a signed-out
  player gets "sign in with Google" and a link to the e-mail sign-in on
  `/online` in place of the play button; an account whose address is not
  confirmed is asked to confirm it; a direct link to a stage goes back to the
  map (`playableStageGuard`, `canEnterStages`). A build with no sign-in
  configured lets everyone play, so a fork still runs without credentials.
- **Classic Bomberman features for the campaign.** Six new items, shown on
  `/items` and hidden by the stages that use them (`items` on a stage in
  `campaign.ts`): wall pass (walk through crates), full fire, power bomb
  (the first bomb of a volley reaches as far as fire goes), the skull (a
  10-second curse — non-stop bombs, no bombs, reversed keys, slow, too fast
  or a short fuse — passed on by touch), the clock (+30 s) and the extra
  life. They stay out of versus and the online room for now; the bots
  already route round skulls, read the power bomb's reach and press the
  other way when cursed. Lives: three per area, a loss costs one and the kit
  and replays the stage, the last one is game over back to the area's start
  (`afterClear` / `afterLoss`). Points: each creature's catalogue value, 500
  an anthill, 5000 the boss, 10 a second left on the clock, kept per run
  with the best on this device. A flame on the uncovered gate brings out two
  more creatures; the snail leaves slime that halves the speed of whoever
  steps in it; the quero-quero dashes at a player in its line of sight. Area
  1 gains a bonus stage (`1-B`): no creatures, an item under every block,
  30 seconds. The stage page opens on a title card and ends on a tally;
  lives, points and best are on the map.
- **The first boss: the Rainha Saúva, on stage 1-5.** `boss.ts` in
  `@libs/game-core` runs her cycle: she digs, moves under the arena (blocks
  and pillars too), cracks the cell of the nearest player for a second and
  comes up there — whoever stays on it is caught, a block there breaks, a
  bomb there goes off — then stands dizzy for two seconds, the only time
  (with the start) a flame hurts her: one hit per flame, eight in all. From
  half health one of two cracks is a feint; on her last two hits she digs
  faster and comes up with two leafcutters. Three anthills stand like blocks,
  send out an ant every six seconds while she lives, and break after two
  flames; her fall takes her ants and anthills with her and opens the gate.
  The stage page shows her health bar; the collection marks a boss beaten.
- **The kit carries over from stage to stage.** What a player picks up in a
  stage — bombs, fire, speed, pierce, remote, glove, kick and the mount —
  goes with them into the next one, up to the game's limits (8 bombs, 8
  fire, speed 4). `PlayerKit` in `@libs/game-core` (`kit.ts`) is read off the
  player when the stage is cleared, saved with the campaign progress and
  handed to the next round through `PlayerSetup.kit`, clamped on the way
  in. Losing a stage loses it all: the kit goes back to the start and the
  area's stages count as never cleared, so the player starts over from its
  first stage (`markFailed`). In a team a player who falls is out until the
  stage ends; if the others clear it they come back next stage with the
  starting kit (`kitsAfterStage`, ready for the co-op room). The campaign map
  shows the kit against the limits.
- **Stage mode is playable: `/campaign/play/<stage>`.** A round can now be a
  stage (`GameOptions.stageId`): `stage.ts` in `@libs/game-core` thins the
  blocks, places the stage's creatures away from the spawn and hides a gate
  under a block. Creatures walk the grid on their own (`wander` turns when
  blocked, `roam` picks a new way at every crossing), take one hit per flame
  and catch a player they touch — a mount still takes that hit. The last
  creature opens the gate; once everyone left has gone through it the stage
  is cleared, and saved to the browser's progress. The arena draws the
  creatures from the campaign art and the gate as a grate that lights up.
  Stages 1-1 to 1-4 open in turn; the boss stage waits for its boss. Solo
  only for now, and a stage has no lives yet: one catch ends the try.
- **Stage mode, first the pages: `/campaign` and `/campaign/collection`.**
  The campaign's catalogue lives in `@libs/game-core` (`campaign.ts`): areas
  in the order they open, their stages and creatures, the boss of each, and
  the rules that turn a player's progress into open, locked and cleared. Area
  1, Gramado, has five stages, four creatures (saúva, pombo, caramujo,
  quero-quero) and the Rainha Saúva; Subestação and Autódromo are announced
  as "coming soon". The creatures' art is data in `@libs/game-client`
  (`creature-art.ts`, painted by `paintCreatureFrame`), so the arena can use
  the same drawings later. The new feature `@libs/campaign` shows the areas,
  a map of the open one with its stages, and a collection where what is not
  reached yet stays a silhouette. Progress is kept in the browser; the stages
  are not playable yet, so the play button says "playable soon". A new area
  is its entry in `AREAS`, its stages' texts in the bundles, and — for a map
  — its art in `area-map.html` and its spots in `area-map-layouts.ts`.
- **A newcomer no longer waits out a round of bots.** When someone queues
  while bots play alone for the audience, that round ends and the countdown
  to theirs starts — them plus the bots `botsFillTo` allows — instead of
  standing them on the border of a five-bot round. A round with people in
  it still runs its course.
- **Fewer, weaker bots online.** A new room rule, `botsFillTo` (3 in the
  public room): an empty room still gets five bots, but with people in
  line bots only complete the round to three players — two for one person,
  one for two, none from three. Bots got a reaction time
  (`reactionTicks`): they notice a bomb only after ~0.75 s at the online
  room's `casual` level and `/play`'s `easy` (their own they always know),
  where they used to dodge on the very tick it landed. They also pick a
  worse refuge now and then (`slipChance`). `casual` no longer reads chains
  and bombs a little less. `medium` and `hard` are unchanged.
- **Play online without an account.** With no sign-in, the queue panel asks
  for a name and "Play as a guest": the server answers with a guest id
  (`guest:<uuid>`) and a token the tab keeps for a reload. Guests queue and
  play like anyone, tagged "guest", but cannot chat and never reach the
  records. A name an account or another guest has is refused, and one
  address holds at most three guest places at once. A round now counts for
  the ranking only with **two signed-in accounts** in it (`countsForRanking`,
  replacing "two people"), so guest tabs cannot farm wins; the queue panel
  shows whether the round on screen is "Ranked" or "Friendly", and a guest
  who wins is told an account would have counted it. A server without a
  Firebase project now lets guests play instead of being watch-only.
- **Leave after this round, online.** A player of the round in progress
  can ask to leave when it ends (`round:leave-after`): the round is played
  out, then they are not put back in line, and a winner gives the seat up.
  "Keep playing" takes it back. The snapshot lists them in `leavingAfter`.
- **Bots in the online room, so it is never empty.** A new room rule,
  `bots` (5 in the public room, `0` off): with nobody in line and someone
  watching, five bots play a round by themselves; with people in line, one
  person is enough for the countdown and bots take the seats left up to
  `maxPlayers`. Whoever queues during a round stands on the border throwing
  bombs, as before — a kill puts them in the bot's place. Bots carry
  people's names drawn per round (`BOT_NAMES`), never queue, never keep a
  seat after a win, and never reach the records: a round counts for the
  ranking only with two people in it. `/status` counts people only. They
  play at a new `casual` level (`@libs/game-ai`), between easy and medium,
  which `/play` does not offer.

- **Play on a phone: an on-screen controller and a full-screen game mode on
  `/play`.** `lib-virtual-gamepad` (`@libs/ui`) lays a thumbstick-as-D-pad
  and the bomb, ability and detonate buttons over the game — pointer events
  with capture, a dead zone and a bias towards the held direction
  (`dragDirection`, pure and tested). `ArenaHandle.controller(playerId)`
  is the hands it drives: the same `DirectionTracker` the keys feed. On a
  touch screen the page goes straight to game mode behind "tap to play"
  (the gesture that unlocks sound and full screen), hides the second
  keyboard player and shows the controller; sideways the arena sits between
  the thumbs with the HUD in the top-left slack, upright it fills the width
  with the HUD and the controller under it. A ⛶ button (and Escape) does
  the same on a desktop, and 🎮 toggles the controller by hand. The page
  has `viewport-fit=cover`, the home-screen metas and a manifest, so an
  iPhone — which refuses the Fullscreen API — gets a full screen once added
  to the home screen. A touch screen held upright plays **sideways**: the
  whole game turns a quarter clockwise by CSS (`play--sideways`), whatever
  the rotation lock says, with the pad reading its directions in the turned
  frame (`[turned]`) and Phaser told the host's own size through the turn;
  🔄 plays upright instead, remembered in `localStorage`. In full screen
  the page also asks for a landscape orientation lock (Android). Phaser no
  longer centres the canvas — the host's stylesheet does (`inset: 0; margin: auto`), since Phaser would measure it through the turn. The site's icon is now the header's burst
  (`favicon.svg`, a PNG-based `favicon.ico`, `apple-touch-icon.png` and
  192/512 maskable PNGs in the manifest) instead of the template's.

- **Player profile on the server: a chosen name, a favourite character and a
  colour.** `GET /me` and `PUT /me` on the game server (bearer Firebase ID
  token, CORS open, `no-store`) read and change the signed-in player's
  record. A chosen name is 2–20 characters, cleaned like a chat line, unique
  on the ranking ignoring case, accents and spaces (`409 name-taken`), and
  survives sign-in instead of being replaced by the account's name. The
  favourite character is the face on the podium; the colour (one of eight,
  `PLAYER_COLOR_IDS` in `game-core`) is handed out per round by
  `assignColors`, first in line first. The room re-sends the ranking and the
  profile after a change. Changing anything takes a confirmed e-mail.

- **A real profile page.** `/profile` (now in the header) shows the signed-in
  player's name, wins, matches and place on the ranking, and lets them
  change the name on the ranking, pick their favourite character and their
  colour, all saved through `PUT /me`. A player still on their account's
  name is invited to choose one. Picking a favourite also selects it in
  this browser. Without a game server the page says profiles are
  unavailable; signed out, it links to `/online` to sign in. The template's
  stub `ProfileService` (`John Doe`) and `lib-user-info` are gone.

- **Players wear their colour.** A round gives each player a colour
  (`Player.color`, `assignColors` in `createGame`): the one on their profile,
  or the closest free one when someone ahead in line has it, or their slot's
  colour. An outsider who gets in takes the victim's colour with their slot.
  The arena paints each slot in its player's colour (`ArenaSkin.load` and
  `loadCharacter` take the colours), the HUD carries `colorSlot`, and the
  podium on `/online` and the title screen paints each face in the player's
  colour (`PodiumLine.color`, a fourth `PodiumPainter` argument). Offline
  rounds keep the slot colours.

- **The favourite character follows the account.** `ProfileSyncService`
  (app-level, started by an app initializer) acts once someone is signed in:
  the account's favourite becomes this browser's character, an account with
  none takes this browser's, and picking another character on the roster
  updates the account. It never loads the auth SDK itself. On `/online` the
  welcome uses the ranking name, and the account panel links to `/profile`
  — inviting a player still on their account's name to choose one.

- **Chat beside the arena, and a full-screen mode.** On `/online` the chat
  is the first card of the right column, next to the arena, with the queue
  under it. A button in the stage's corner expands the page: the arena
  fills the screen (the browser's full screen too, where allowed) and the
  chat docks on its right with the newest line at the bottom, the way a
  live stream shows its chat; `✕` or Escape comes back. The canvas never
  remounts — only the layout changes. `lib-chat-panel` gained a `dock`
  input for that height-filling form.

- **Mounts page.** `/mounts` (`libs/mounts`, "Mounts" in the header), laid
  out like the characters page: the mounts listed on the left, and the
  chosen one on a stage ridden by your character — turned by a click, the
  eight poses around it, a walk button — with a little video of its
  ability played by the rules themselves (`mount:<id>` scenes in
  `demoScene`, with a new `face` step and `mounts` seating in
  `DemoScene`), the ability's numbers straight from the rules
  (`abilityFacts`), and the story. The mounts section leaves the
  characters page, which links here instead. The preview painter now
  draws Pato's jump as an arc and Tatu's sprint with a trail.

- **The ranking beside the arena.** `/online` is three columns on a wide
  screen: the ranking on the left, with the top three on the shared
  `lib-podium` wearing their last characters and the rest of the list from
  fourth place under it, the arena in the middle, the room on the right.
  Narrower, the ranking goes under the arena. `lib-ranking-list` gained
  `start` and `titled`.

- **The round's HUD over the arena.** The clock and who is in with what
  (`lib-players-panel [compact]`, `lib-player-badges [size]="'sm'"`) sit
  in a thin strip along the top of the stage instead of a sidebar card,
  so they are in view in both layouts.

- **Play on the arrow keys.** `@libs/controls-settings` keeps which hand
  player 1 drives with (`wasd`, the default, or `arrows`), in
  `localStorage`. Settings has a "Controls" section with the choice and
  what each hand does; `/play` has the same choice in "Who plays" and seats
  player 1 on the chosen hand, a second player on the other — alone, both
  hands drive player 1, as online. `PLAY.CONTROLS_P1/P2` became
  `PLAY.KEYS_WASD_HINT/KEYS_ARROWS_HINT`.

- **The idle rule.** A new room rule, `idleMs` (30 s in the public room,
  `0` off): a person in a round who sends no input for that long is taken
  out of it — eliminated, so the others can finish — and out of the line,
  told why (`error: idle`), with a line in the chat (`idle-out`). A phone
  that went dark or a tab left open no longer stands in the arena round
  after round. Bots are never idle. On the rules panel like the others.

- **Phones play online too.** `/online` now has what `/play` had: on a
  touch screen, joining the queue fills the screen with the room and the
  on-screen controller (`lib-virtual-gamepad`, driving the first keyboard
  scheme's tracker through `handle.controller`), held upright the room
  turns sideways with 🔄 to play upright (the same remembered choice as
  `/play`), and full screen is asked of the document so the turn survives
  it. The chat steps aside while the screen is the arena; collapsing
  brings it back.

- **The online room reconnects on its own.** A dropped socket no longer
  ends in "the connection fell" and a button: the store tries again after
  a pause that doubles from 1 s to 30 s (with jitter), at once when the tab
  comes back into view or the network returns, and sooner when the server
  announced a restart (`server:restarting`, broadcast by the room before
  it lets everyone go). It asks for the same session back by Colyseus
  reconnection token — kept in memory and `sessionStorage`, so a reload
  gets it too — and the room holds a dropped player's session for the
  grace, now 60 s instead of 15 (`allowReconnection`), welcoming them back
  with the room's state, identity and place intact and no `hello` needed;
  a watcher just rejoins. Pings are gentler on phones: five seconds apart,
  three misses before a drop (~20 s, was ~9 s).

- **One way in: "Jogar".** The home hero has a single button, Jogar, to
  the online room (the offline and guest buttons are gone), and so does the
  closing band; the header's first link is Jogar, to /online, the Início
  and Online links are gone and its button says Jogar too. `/play` stays
  reachable from the arenas and by its address. `HOME.CTA_ONLINE/GUEST/LOCAL`
  and `HEADER.ONLINE` are gone from the bundles.

- **Analytics events for what players do.** Beyond the automatic
  `page_view`, the app now logs `play_click` (`mode`, `from`: hero, band
  or header), `match_start` on `/play` (`map`, `bots`, `level`,
  `second_human`, `touch`), `queue_join` on `/online` (`character`) and
  `round_end` on both (`mode`, `winner` — human/bot/draw locally,
  me/other/draw online — plus `map` and `seconds` locally, `watching`
  online). All through the `ANALYTICS` token, so a build without Firebase
  logs nothing and needs no guards.

- **Gramado, the plain arena.** A third map (`gramado`, no extra walls):
  a mown lawn in a walled yard — cut stone cubes for pillars, clay-brick
  blocks for crates, a dry-stone wall with a hedge along the top, an old
  well as the feature. No blackout, no rain: the arena to learn on and
  the quick versus. Listed on `/arenas` with the local match as its video,
  `MAPS.GRAMADO.*` in both bundles.

- **The arena is painted at the screen's density.** The HD skin's tiles,
  characters, bombs, flames and items were always painted at 64 px and
  scaled up to the page — twice over on a dense screen — and went soft.
  `ArenaSkin.resolution` (`HD_RESOLUTION`: the device's pixels per CSS
  pixel, whole, 1 to 2) now paints every texture that many times finer in
  the same 64-unit art (`paintHdTextures`, `paintCharacterTextures`, the
  themes' `tilePainter`, cached per resolution), the game canvas grows with
  `tileSize`, and the page scales it down instead of up. The rain scales
  with it. Previews outside the arena still paint at 1.

### Security

- **Nobody can open a second online room.** Colyseus exposes `create` and
  `joinOrCreate` on `/matchmake/*` by default, and the public room never
  disposes itself, so each such request left one more room ticking on the
  server. The server now exposes `join`, `joinById` and `reconnect` only,
  the room refuses a second instance of itself, and the client joins with
  `join`. Deploy the site before the server: an old page still asks for
  `joinOrCreate`.
- **The game server can listen on one interface.** `HOST` (or `"host"` in
  `config/game-server.json`) picks it; unset, it listens on all of them as
  before. Behind a tunnel on the same machine, `127.0.0.1` keeps the server
  reachable through the tunnel only.

### Fixed

- **The online scoreboard no longer covers the arena.** The round's clock
  and players sat over the top of the board, and a full round wrapped onto
  its first playable row. They now have a strip of their own above the
  arena (kept open between rounds, so the page does not jump), a phone
  shows them as one row swiped sideways, and the strip leaves out a speed
  of 0.

- **`/online` flickered after leaving and coming back.** The router keeps a
  route's providers alive across visits, so the online store — and its
  socket — survived the page. Coming back opened a second connection beside
  the first; both fed the same frame listeners, ticks ran backwards and the
  arena was rebuilt on every frame. The store now leaves its previous
  connection before opening another, and the page leaves the room when it
  is destroyed, so a watcher who left no longer counts. The arena's
  text-field focus sync also no longer runs on a destroyed game.

- **Outsiders on the border are easy to see.** They were drawn under the
  arena's vignette and tinted darker, so on the dark wall — and worst in the
  corners — they nearly vanished. They now sit above the vignette with a pale
  rim (WebGL filter), bob while they wait, and the one on the top wall is no
  longer cut off at the canvas edge.

- **Bots use the remote bomb.** A bot that picked up the remote laid one
  bomb and never set it off — easy and casual never pressed the button,
  medium and hard only with an enemy in the blast — so it could lay no more
  and stood idle for the rest of the round. Every level now sets its oldest
  remote bomb off once it has waited a fuse and the bot is out of the blast
  (medium and hard still fire early on an enemy), and a bot reads its own
  remote bomb as one about to go, so it no longer parks inside the blast.

- **The keys come back from the chat.** Clicking the arena after typing in
  the chat left the keys in the text box (Phaser cancels the pointer's
  default action, which is what would have moved focus). The scene now
  blurs the field on a pointer down on its canvas; Escape in the chat box
  does the same without leaving full screen, and the box says so while it
  has focus.
- The expanded `/online` layout now sits above the site's fixed header for
  browsers that refuse full screen.

- **Google sign-in on a custom domain.** `authDomainRedirect` now sends
  `<projectId>.web.app` and `<projectId>.firebaseapp.com` to a custom
  `authDomain` too, so with `authDomain` set to the custom domain every
  Hosting address signs in on the same origin instead of stopping on a blank
  `/__/auth/handler`.
- **Deep links no longer serve a stale `index.html` for an hour.** The
  hosting `no-cache` header matched only the literal `/index.html`, so `/`
  and routes such as `/mounts` got Firebase's default `max-age=3600` and kept
  loading the previous bundle after a deploy. It now matches every path
  without a file extension.
- **The game server died on its first HTTP request.** Colyseus binds its own
  request listener to the HTTP server it is given, so `/ranking`'s handler
  and Colyseus both answered every request and the second answer threw
  (`ERR_HTTP_HEADERS_SENT`) — also turning matchmaking posts into 405s.
  `httpHandler` now claims only `/ranking` and `/` (returning whether it
  did), and `main.ts` runs it ahead of Colyseus' listener for the rest.

### Changed

- **The home page's controls show the phone too.** Beside the two
  keyboards, a picture of a phone held sideways plays a little match under
  the game's own controller (inert, out of the tab order), with a legend
  of its four controls. `lib-virtual-gamepad` takes `--gamepad-button`,
  like `--gamepad-pad`, to size its buttons.

- **The home page's power-ups and controls read as one design.** The two
  sections had left-aligned eyebrows over centred titles (the `--left`
  modifiers lost to `.home-h2`'s centring) and a long power-up list beside
  a short controls column. Power-ups are now a grid of equal cards — with
  the glove and the kick, which were missing — and a link to `/items`;
  the controls have a section of their own, two matching keyboards side
  by side.

- **Gramado leads the arena list, and the grid ends with "Coming soon".**
  The plain arena is now first in `MAPS`, so `/arenas`, the arena detail's
  "other arenas" and `/play`'s map picker list it first; a round still
  plays on `DEFAULT_MAP_ID` unless another is asked for. The arena gallery
  closes with a card for the arena still on the drawing board.

- **Three ways to play from the home page.** The hero now offers "Play
  online", "Play without an account" (the online room as a guest) and
  "Play offline" — the old "Local versus", renamed everywhere it appears,
  since `/play` is the bots as much as a friend on the keyboard.
  `play_click` reports the new button as `mode: 'guest'`.

- **The game server moved to `https://api.detona.online`.** The hosting CSP
  `connect-src` lists it in place of `game.cragvia.com`; the tunnel route
  still points at `http://localhost:8086`.
- **Pato hops over pillars.** The jump crosses up to 3 cells of crates,
  pillars or bombs, not only crates and bombs; the arena's border is the
  one thing it never clears (`jumpLanding`). A rules change: deploy the
  front and restart the server together.

- **Pato hops one cell, Tatu rolls.** The Pato's jump clears exactly the
  next cell (`JUMP_REACH` 1) and lands on the one after; if that one is
  taken there is no jump — it no longer looks further for room. The Tatu's
  sprint is now a roll: straight ahead the way the keys point as it starts,
  no steering until it stops — against a wall, crate or bomb (kicking it,
  with the kick), on a second press, or after 4 s, enough to cross the
  arena. Their demo scenes and ability strings follow.

- **The Galinha replaces the Poraquê.** The electric eel in a wheeled tank
  is gone; its mount slot is now an electric hen (`MountId` `'galinha'`):
  white feathers, a comb shaped like a lightning bolt, wings and tail tipped
  in sparks, the rider on a team-coloured saddle (`cartoon/galinha.ts`). The
  ability is unchanged — Short circuit, every bomb within two cells goes off.
  Her sound clucks before it crackles. Renamed with it: the demo scene
  (`GALINHA_SCENE`), the sound and quip key `mount-galinha`, and the strings
  `MOUNTS.GALINHA`, `ITEMS.EFFECT_MOUNT_GALINHA`,
  `SOUNDS.EFFECT_MOUNT_GALINHA`, `SOUNDS.MOMENT_MOUNT_GALINHA`. Client and
  server must ship together: the id travels in every frame.

- **Audio moved into the settings.** The header no longer links to the
  sounds page. The settings page has two sections, General and Audio; Audio
  holds the music and effects switches and a link to the sounds page, which
  now lives at `/settings/audio` (`/sounds` redirects there). `@libs/sounds`
  and `@libs/settings` still never import each other: the app's routes put
  one under the other. `HEADER.SOUNDS` is gone from the bundles.

- **Riders keep their size.** A character on a mount was drawn at 64 % of
  their size to fit mount and rider in one cell, and read as a child on a
  toy. Riders are now at 92 % (`RIDER_SCALE` in `cartoon/ink.ts`), and
  mounted HD frames are 18 units taller (`MOUNTED_HEADROOM`): the mount
  stands in the cell as before and the rider's head rises above it, as in a
  3/4 view. The arena stands every player frame on the cell whatever its
  height, the preview painter does the same, and roster cards shrink a
  mounted frame to fit their square.

- **A bomb on the head bounces.** A bomb in the air — kicked, thrown with
  the glove or from the border — that comes down on a player standing there
  no longer stops on top of them: it bonks them and bounces one cell on.
  The one it hit is dizzy for a second (`STUN_TICKS`) and loses up to two
  items above the starting kit (`BONK_DROPS`: extra bombs, fire, speed,
  kick, remote, pierce — never the glove), which land on free floor around
  them. Which two depends on the tick, not on chance, so a replay or the
  server always agrees. New `bonk.ts` and events `player-bonked`,
  `power-up-dropped`. A player in mid-air is flown over, as before.

- **The last one standing wins.** A round is decided the moment one player
  (or none) is left; the 1.5 s before it is over are for the result only.
  Until now the survivor could still die in that time — a flame still
  burning, a falling wall — and the round became a draw, which mostly hit a
  rider whose mount had just taken the blast. Now nobody dies once it is
  decided (`isDecided` in `game-core`): flames and falling walls kill no one
  and `eliminatePlayer` does nothing. Players who fall in the same tick still
  draw. Local and online play both get it.

- **Winner stays.** In the online room the winner of a round plays the
  next one too, first in line with the next four, until `winnerStays` wins
  in a row (a new room rule: off, 2, 3, 5 or 10; default 5). The losers go
  to the back of the line, best placed first. The snapshot carries
  `champion { id, streak }`; the queue panel crowns the champion, and the
  chat announces the streak. `Lobby.finishRound` takes the round's
  standings and returns the outcome.

- **Chat and reactions in the online room.** Under the arena, everyone reads
  the conversation and anyone can send a reaction (🔥 😂 💣 👏 😱 👀) that
  floats over the arena; writing takes a confirmed account. Lines show the
  author's role (playing, in line, watching), and the room writes who won a
  round and who got in from the border. Limits live in `Chat`
  (`@libs/game-lobby`): 140 characters, one message per 2 s and five per
  15 s, no repeats within 30 s, the last 50 messages kept in memory only, 20
  sent to a newcomer. Admins remove a line or silence an account. New
  messages `chat:send`, `react`, `chat:delete`, `chat:mute` and
  `chat:history`, `chat`, `chat:removed`, `reaction`; new server errors
  `chat-slow-down` and `chat-muted`. The arena no longer reads keys while a
  text field has focus.

- **Sign in with Google.** The online room's account panel has a "Sign in with
  Google" button above the e-mail form. `Auth` gains
  `signInWith(provider: AuthProvider)` (only `'google'` for now) and the error
  codes `popup-blocked` and `cancelled`; `FirebaseAuth` opens a popup and loads
  the popup resolver only for that call, so e-mail sign-in still never fetches
  `apis.google.com`. Google accounts come confirmed, so they queue straight
  away. The hosting headers now allow the popup: `apis.google.com` in
  `script-src`, `frame-src 'self' https://*.firebaseapp.com` (`'self'` for an
  `authDomain` on the site's own domain), and
  `Cross-Origin-Opener-Policy: same-origin-allow-popups`. A fork enables the
  provider in Firebase → Authentication → Sign-in method, sets `authDomain` to
  the site's own domain and adds its `/__/auth/handler` to the OAuth client's
  redirect URIs (the `firebase-deploy` skill explains why); an implementation
  of `Auth` outside this repo must add `signInWith`. An error code Firebase
  returns that `toAuthError` does not map is logged with `console.warn`
  (`[auth] unmapped error`), since the UI only shows "Something went wrong".
  `provideFirebaseAuth()` redirects whichever of `<projectId>.web.app` and
  `<projectId>.firebaseapp.com` is not the `authDomain` to the one that is,
  because sign-in cannot complete on the other. On the `authDomain` itself,
  Google sign-in now redirects the page instead of opening a popup: the
  popup's result was recorded by Firebase but did not reach the page. `Auth`
  gains `takeRedirectError()`, which the online page reads after
  `initialize()`; an implementation of `Auth` outside this repo must add it.

- **Bots, offline.** `/play` now opens with a "Who plays" panel: 0–4 bots
  (0–3 with a second player on the arrow keys), Easy / Medium / Hard, carried
  in the URL (`/play?bots=3&level=hard&p2=1`); the default is one medium bot.
  The brains live in a new library, `@libs/game-ai` (`scope:game-ai-lib`,
  depends on game-core only, so the game server can run the same bots
  later): a danger map that times every blast (chains, thrown bombs, the
  closing walls), a timed path search that never walks into fire, a bomb only
  ever dropped with a way out checked first, and — on Hard — traps for
  enemies with nowhere to run. A level is data (`BOT_PROFILES`); the plan
  layer is the slot a future strategist (an LLM, say) would fill. A headless
  tournament in the specs checks that Hard beats Easy and that bots rarely
  blow themselves up. `LocalSession` takes the bot seats; `ArenaOptions.bots`
  passes them in.

- **The glove grabs players.** Facing a player right next to you, the bomb
  key lifts them overhead (`player-grabbed`): they cannot move, drop bombs or
  burn, and wriggle free after 2 s (`CARRY_TICKS`). The bomb key again throws
  them 3 cells the way you face (`player-thrown`), over anything, bouncing to
  a free cell and wrapping round the arena like a thrown bomb; they land
  dizzy for 1 s (`STUN_TICKS`, `player-landed`). New `grab.ts`; `Player`
  gains `carrying`, `carriedBy`, `carriedUntilTick`, `flight` and
  `stunnedUntilTick`; `ThrownBomb` now extends a shared `Flight`, which
  `flightPosition` accepts.

- **Player badges** (`lib-player-badges`, `@libs/ui`): a player's stats as a
  row of icon badges — a count beside bombs, fire and speed; only the icon
  for a one-off item (pierce, remote, glove, kick), the seconds for the
  vest, the mount and its ability's state — with the name on hover and for
  screen readers. `/play` and the online players panel use it, so a card
  stays one row whatever was picked up. The `/play` header shows the arena
  and the round's clock as pills under the title; an eliminated player gets
  an "out" tag instead of a strike-through.
- **The title screen says who is online.** The hero leads with _Play
  online_ (local versus beside it), a live pill under the buttons — "3 online
  now · a round is on", refreshed every 30 s while the tab is visible — and
  the stage plays a live match instead of a still. Badge, facts and ticker no
  longer say "coming soon" or "four players". The server answers
  `GET /status` (`RoomStatus`: online, phase, playing, queued) from the room's
  listing, which `refreshLobby` keeps in the room's metadata.
- **Podium on the title screen.** The top three of the online ranking, on
  a podium with the character each last played, joke titles by place and a
  line earned by the win rate; an empty board invites the first win. The game
  server now answers plain `GET /ranking` (JSON, open to any origin, cached
  30 s) on the socket's port, so a page reads the leaderboard without joining
  the room; records remember each player's last character (`characterId` on
  `PlayerRecord` and `RankingEntry`).
- **The arenas' special moments happen.** They were only described; now
  the Subestação's lights go out every 30 s for 2 s (bombs and flames stay
  lit, players become silhouettes) and it rains on the Autódromo the whole
  race (streaks across the screen, a wet sheen on the asphalt). Visual only,
  timed from the tick, so every client and the previews agree
  (`ArenaTheme.moment`, `blackoutAt`); previews quicken the blackout to 8 s.
- **Arenas play their video too.** The gallery and each arena's page show a
  live match on that arena instead of a still (`DemoVideos`, moved to
  `@libs/game-client`, drives any canvas with `data-video`: `local`,
  `online`, `arena:<id>` or `ranking`). A new arena needs no new code to get a
  preview: without a scene of its own it plays the local match on its map;
  one with a story (co-op stages, a fight pit) gets an entry in `DEMO_SCENES`.
- **Live previews on the mode cards.** The title screen's three modes play a
  little match each, run by the rules themselves (`ModeDemo` steps
  `createGame`/`tick` on a carved arena with a scripted cast: walk to a cell,
  drop a bomb, wait) and painted with the HD skin on a plain canvas
  (`FramePainter`; no Phaser on the home). Versus local: Faísca breaks a
  crate, takes the fire and catches Dra. Lia. Online: five in the arena, the
  next in line on the wall, a thrown bomb and the thrower stepping in.
  Ranking: the leaderboard with someone climbing. Only cards on screen are
  painted; reduced motion shows a still. Online and Ranking are no longer
  "coming soon" on the home.
- **Room rules from the page.** The online room's rules (`RoomRules`: who
  stands outside, min/max players, countdown, results time, the round clock
  and the closing walls) are now the room's feature flags. Everyone sees them
  on `/online`; an **admin** — an e-mail listed in `config/game-server.json`
  (`admins`) or `ADMINS` on the server — changes them there, with
  `rules:set`. Between rounds a change applies at once; during a round the
  lobby holds it (`nextRules` in the snapshot) and the next round plays by
  it. The server saves them to `rules.json` under `DATA_DIR` and loads them
  at boot, over the environment. A new rule is one entry in `RULE_FIELDS`
  plus its `ONLINE.RULES.<KEY>` strings; the panel draws itself from the
  schema. New server message `admin`, new error `forbidden`.
- **Round clock and closing arena.** A round of two or more lasts 3 minutes
  (`ROUND_TIME_TICKS`, shown as `m:ss` above the arena and in the online
  room). When it runs out the announcer shouts and a wall drops every 0.3 s
  (`CLOSING_STEP_TICKS`) in a clockwise spiral from the top-left corner, until
  one player (or none) is left. A falling wall crushes whoever stands there —
  no mount, vest or shield saves them, and the kill is nobody's — and takes
  any bomb, item or burning crate under it. `GameOptions.roundTicks` sets the
  clock (`null` for none; a one-player sandbox never has one) and
  `GameOptions.closingWalls: false` makes time-up a draw instead. New module
  `closing.ts`, events `arena-closing` and `wall-dropped`, `HudSnapshot`
  fields `secondsLeft` and `closing`, sounds `alarm` and `wall`, announcer
  moment `hurry`.

- **Mount abilities, new scheme.** Tatu now **sprints** (`dash`: +3 cells/s
  for 1.5 s, still bombing, still mortal) instead of rolling, and Bernardo
  drops a **barrage** (`line-bombs`: 3 bombs at once, under the rider and on
  the free cells ahead, over the bomb limit) instead of sniffing. Pato's hop,
  Capivara's walk-over-bombs and Poraquê's short circuit are unchanged.
  `isRolling`/`isSniffing` are gone, `isDashing` arrives, and `speedOf` takes
  the tick for the sprint. The mount cards describe the new abilities.
- The characters page shows the eight poses around the stage — the sides
  standing, the corners walking — instead of a row of four.
- Mounts redrawn to the classic rider-on-the-back proportion: the rider at
  64 %, taller bodies, bigger heads; the Poraquê is a proper aquarium.
- **Glove** and **Kick**, two new power-ups (2 of each per arena). With the
  glove, the bomb key picks up the bomb you just dropped (before stepping off
  it) and a further press throws it 3 cells the way you face; you can walk
  with it, and its fuse keeps burning in your hands — a flame where you stand
  sets it off. With the kick, walking into any bomb sends it hopping 1 cell.
  Both fly over crates, stone and bombs, bounce on to the next free cell, and
  wrap round the arena: out at the top, in at the bottom. A bomb always
  belongs to whoever dropped it, so the kill is theirs. One flight for the
  glove, the kick and the outsiders' throw lives in `throw.ts`; `ThrownBomb`
  now carries the bomb's direction, range, fuse, pierce and remote, and
  `flightPosition` gives its place on screen, wrap included. New events
  `bomb-picked-up` and `bomb-kicked`, new sounds `throw` and `kick`, HUD
  badges, item pages and art in both skins. An item's key hint is now its
  own (`itemKeys(...).hintKey`) instead of the remote's for every item.

- **Outsiders** in the online room: while a round is played, the first few
  in line (`RoomRules.outsiders`, 5 in the public room, `OUTSIDERS=0` on the
  server turns it off) stand on the border wall, walk around it and throw
  bombs 3 cells in with the bomb key. A thrown bomb flies for 0.6 s, lands on
  the first free cell and burns like a starting bomb. Whoever gets a kill
  from outside steps into the arena on the victim's cell, with the starting
  kit and 1 s of immunity, and plays the rest of the round; the next in line
  takes their place on the wall. Flames now remember whose bomb lit them
  (`Flame.ownerId`), `player-died` carries a `killerId`, and a frame carries
  the room's `round` number so the arena stays up when a player is added
  mid-round. Skins may paint a character on demand (`ArenaSkin.loadCharacter`).

- **Poraquê**, a fifth mount: an electric eel in a wheeled fish tank, hatched
  from the egg like the others. Its ability, **Short circuit** (`short-circuit`),
  sets off every bomb within 2 cells, anyone's, at once; no cooldown. Painter,
  zap sound, announcer lines and en/pt strings included.
- **Tião**, the electrician who runs the Substation: a new `works` group
  ("Works"/"Obras"), a cartoon painter with hard hat, moustache, tool belt
  and pliers, and his story in en/pt. The Substation is now his workplace.
- **Online room** (`/online`, `@libs/online`): one public arena anyone can
  watch live. Signed-in players with a confirmed e-mail join a queue; up to
  five play a round. A full arena starts at once, otherwise a 15 s countdown
  starts when two are in line. Newcomers queue for the next round, and after
  a round the waiting players go first and the round's players go to the back,
  winner first. A ranking and a per-account profile (wins, matches, visits,
  "welcome back") come from the server.
- The online room shows **who is watching** (signed-in viewers by name, the
  rest as a count; `LobbySnapshot.watchers`) and an **"In the arena" panel**
  with what each player has picked up: bombs, fire, speed, pierce, remote,
  vest time and mount, fed by the arena's HUD.
- **`apps/game-server`**: a Node + Colyseus server on port 8086 (`PORT`). It
  runs the same `@libs/game-core` rules at 60 Hz, sends 20 frames a second,
  checks Firebase ID tokens against Google's public keys with `jose` (no
  service account) and keeps player records in a JSON file under `DATA_DIR`.
  `npm run start:server` runs it; `nx test game-server` runs its Node specs,
  including an end-to-end room test with real sockets.
- `@libs/game-protocol` (the wire contract and validators shared by server
  and browser) and `@libs/game-lobby` (the queue state machine and the player
  records, pure and fully unit-tested).
- **Accounts**: `@libs/auth` (the vendor-neutral `AUTH` token, `NoopAuth` by
  default) and `@libs/auth-firebase` (`provideFirebaseAuth()`, e-mail and
  password with a confirmation e-mail, SDK loaded with `import()`).
- `config/game-server.json` / `GAME_SERVER_URL`, generated into
  `environment.gameServerUrl`. Development falls back to
  `http://localhost:8086`; production hides the online room when it is unset.
  `environment.authEnabled` is new as well.
- Five players per round: a fifth spawn in the middle of the arena, with the
  3 × 3 box around every spawn free of crates, and a fifth player colour in
  every skin.

### Fixed

- The game server could ignore SIGTERM (its own handler raced Colyseus'), so a
  restart left the old process holding port 8086 while the new one sat idle.
  Shutdown is now handled once: flush the records, close the rooms, exit
  within 3 s.
- A player who left mid-round (closed the tab or signed out) stood still
  forever, so the round never ended and the queue stayed stuck behind it. The
  server now eliminates them with the new `eliminatePlayer` from
  `@libs/game-core`; with two players, the one who stayed wins.
- Reloading the page mid-round no longer costs the round: a dropped
  connection keeps its character (or queue spot) for 15 s
  (`RECONNECT_GRACE_MS`), and signing back in hands the keys back without
  rebuilding the arena. Signing out on purpose (`sign-out` message) still
  gives the place up at once.
- i18n bundles were served with a one-year `immutable` cache under fixed
  names, so a returning visitor saw raw keys for every string added later.
  JSON now revalidates, and the loader requests `<lang>.json?v=<hash>`, where
  the hash of the bundles is generated into `environment.i18nVersion`.
- Firebase Auth starts with `initializeAuth` and persistence only, so it no
  longer injects `apis.google.com/js/api.js`, which the CSP blocks and e-mail
  sign-in never needs.
- Safari could not open the online room: the Colyseus SDK's Node-style
  `WebSocket` call fails there without throwing. The client hands the SDK a
  `WebSocket` that accepts both forms.

### Changed

- Mount abilities have no cooldown: Tatu's roll, Pato's jump and Bernardo's
  sniff can be used again as soon as the previous one ends (`cooldownTicks: 0`).
- Both maps lost their centre wall (the generator and the gantry): the middle
  is now the fifth spawn.
- `ArenaScene` draws any `ArenaSession`; `ArenaOptions.session` lets the arena
  mirror an online round instead of running a local one.

- Languages reduced to English and Portuguese: the `Language` enum, its
  metadata, the bundles, the feature-lib generator and the docs. RTL support
  stays in the metadata (`dir`) for whoever adds an rtl language back.
- The developer character is now called **Tired Dev** (`Dev Cansado` in
  Portuguese); its id stays `byte`.

### Added

- **Novato** (Rookie), the plain default player: no job and no props, a tee
  and a cap in the team colour. First in the roster, under the `starter`
  group, and `DEFAULT_CHARACTER_ID`.
- The cast. Four hand-drawn cartoon characters, each with a job and a story,
  grouped by profession (`CHARACTER_GROUPS`, so a group such as IT can hold
  several): **Faísca** the sapper, **Tired Dev** the developer, **Dra. Lia**
  the doctor and **Zé Motoca** the delivery rider. Four mounts that belong to
  nobody: **Tatu** the armadillo, **Pato** the rubber duck, **Bernardo** the
  Saint Bernard and the **Capivara**. The catalogue (`CHARACTERS`,
  `MOUNTS`) lives in `@libs/game-core`; the painters in `@libs/game-client`
  (`characters/cartoon`) draw both the roster and the arena textures.
- `@libs/audio-settings` — `AudioSettingsService`: the arena music (off by
  default: it loops for a whole match) and the sound effects (on by default),
  persisted, with two switches on the settings page. The play page's own
  toggles read and write the same service, so the choice is one.
- Three more items under the crates, one of each per arena: the **piercing
  bomb** (`pierce`: flames go through every crate in range), the **remote
  control** (`remote`: bombs have no fuse; a dedicated detonate button,
  `PlayerInput.detonate` on E and /, sets off the oldest) and the **vest** (`vest`: `VEST_TICKS` of
  immunity). They show in the HUD, tint the bombs in the arena, and have their
  cards on the items page and the home.
- Mount abilities. Each mount does one thing on top of the speed and the
  absorbed hit: Tatu rolls (immune for a second), Pato hops over the cell
  ahead, Bernardo sniffs out what nearby crates hide, and the Capivara walks
  over bombs. A third button (`PlayerInput.ability`; Shift for player 1, Ctrl
  for player 2), cooldowns in ticks on the mount catalogue, the `ability-used`
  event, and the HUD counting the cooldown down.
- The egg. A fourth power-up hidden under the crates: pick it up and it hatches
  into a random mount (`hatchMount`, deterministic from the game state so a
  server agrees). Mounted players move faster (`MOUNT_SPEED_BONUS`) and the
  mount takes the first flame in their place, with a short shield afterwards
  (`MOUNT_SHIELD_TICKS`). New events `mount-gained` and `mount-lost`, new
  textures `player-<slot>-<mount>-<facing>-<frame>`, and the HUD shows the
  mount.
- `@libs/characters` — the roster page at `/characters`: pick who you play
  as, turn them around, set them walking, mount up, read their story.
- `@libs/character-select` — `CharacterSelectionService`, the chosen
  character shared between the roster and the game, persisted like the theme.
  The versus match gives player 1 the choice and player 2 the next character.
- `PlayerSetup.characterId` and `Player.characterId` in the rules;
  `ArenaSkin.load(scene, characters)` so a skin paints each slot's character.

## [1.0.0] - 2026-08-09

First stable release: everything below is the baseline a fork starts from.

### Added

- Storybook for the design system — `npx nx storybook ui` serves every `@libs/ui`
  component with controls, a design-token **theme** toolbar (light/dark) and a
  **direction** toolbar (LTR/RTL). Stories are colocated (`*.stories.ts`),
  excluded from the lib build and coverage, and `ci.yml` builds the catalogue on
  every PR. It deploys as a second Firebase Hosting site (target `storybook`),
  gated on the `FIREBASE_STORYBOOK_SITE` variable — unset, a fork ships nothing
  extra. New skill: `.claude/skills/storybook/`. `deploy:firebase` now targets
  `--only hosting:app`.

- `LANGUAGE_METADATA` in `@libs/entity` — the single source of truth for
  language display data: endonym label and text direction. The header select,
  the settings radio group and `<html dir>` all derive from it, so adding a
  language is one enum line, one metadata entry and one bundle.
- `lib-language-select` (`@libs/ui`, `molecules/`) — the language picker
  extracted from the header into the design system. Options are labelled with
  endonyms (each language named in itself), never translated.
- `lib-switch` (`@libs/ui`, `atoms/`) and `lib-segmented-control` (`@libs/ui`,
  `molecules/`) — the toggle switch and the `role="radiogroup"` segmented
  control extracted from the settings page, which had implemented both inline
  (the segmented control twice). Both are controlled components: the host owns
  the value, the control only asks for a change. The switch also drops the
  literal-`#fff` knob for surface tokens, which was invisible on the dark
  theme's white brand track.
- `lib-page-header` (`@libs/ui`, `molecules/`) — the shared h1-plus-lead page
  intro, previously restyled separately by the settings and design pages.
- `github` in the shared icon set. The header and the home CTA now render it
  through `lib-icon` instead of carrying two copies of the same inline SVG;
  the header's menu/close burger also uses the set's existing icons.

### Changed

- `deploy.yml` no longer hardcodes the demo's Hosting URL as the GitHub
  environment `url` — the last piece of project identity in CI; a fork's
  Actions UI no longer links to this template's site.

- The home page now consumes the design system — `libButton`, `lib-badge`,
  `lib-card`, `lib-icon` — and design tokens instead of hardcoded Tailwind
  neutral colours, so the landing finally follows the theme toggle. Its
  closing CTA section remaps the surface tokens locally to stay inverted in
  both themes.

- Language pickers no longer translate language names. The `LANGUAGE.*` key
  matrix (one name per language per bundle) is gone; `LANGUAGE_SELECT.*` holds
  the two remaining aria labels.

### Removed

- `UpdateLanguageComponent`, `updateLanguageRoutes` and the `/translate` route.
  The settings page supersedes it, and its hardcoded language list had already
  drifted from the enum. The `UPDATE_LANGUAGE.*` keys went with it.

- Four more languages — Spanish (`es`), German (`de`), Arabic (`ar`) and Polish
  (`pl`), for eight bundles total. `provideDocumentLanguage()` now also syncs
  `<html dir>`, so Arabic renders right-to-left; styles written with physical
  properties (`margin-left`) keep their LTR bias and are fixed case by case.
  English remains the default and fallback.
- "View source on GitHub" links (header icon + home CTA button), driven by
  `config/site.json` / `SITE_REPO_URL` through the config generator as
  `environment.repoUrl`. Absent config renders no links, so a fresh clone stays
  unbranded; the deploy workflows derive the URL from `github.repository`, so a
  fork's deploy links to the fork.
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and this changelog —
  the repository could not legally be used as a template without the first one.
- `@libs/analytics` — a vendor-neutral `ANALYTICS` token with a `NoopAnalytics`
  default, so analytics is opt-in and the core no longer knows Firebase exists.
- `@libs/analytics-firebase` — the Firebase implementation, behind
  `provideFirebaseAnalytics()`. It is the only project in the workspace that names
  Firebase.
- `@libs/settings` — a second feature library. Deliberately a different shape from
  `@libs/profile`: synchronous, locally persisted state instead of HTTP +
  `rxMethod`.
- `config/` + `tools/generate-config.mjs` — one JSON file per integration, pasted
  straight from the vendor console, compiled into typed modules under
  `libs/environment/src/lib/generated/`. Both sides are git-ignored, so no one's
  Firebase project id is ever committed. See `config/README.md`.
- Playwright end-to-end suite (`apps/demo-app/e2e/`) wired into CI, and re-run
  against the deployed preview channel on every pull request via `BASE_URL`.
- Jest coverage thresholds, enforced in CI.
- husky + lint-staged + commitlint, including a pre-commit guard that rejects a
  populated Firebase `apiKey`.
- Renovate configuration, with a rule that moves `@ngrx/*` off the 22 prerelease
  line as soon as a stable release exists.
- Firebase Hosting deploy workflow on `main` and a preview-channel workflow per
  pull request.
- Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) in `hosting/firebase.json`.
- `libs/shared/ui/src/lib/organisms/` — the folder the documentation had been
  claiming existed.
- Unit tests for every `@libs/ui` atom (alert, badge, button, card, icon,
  spinner, theme-toggle) and for the header organism — the coverage floor rose
  from the high thirties to the mid eighties with them.

- `AGENTS.md` — a single entry point for AI coding agents, imported by `CLAUDE.md`
  so every tool reads one file instead of a per-vendor copy.
- `tools/workspace-plugin` with a `feature-lib` generator
  (`npx nx g @app/workspace-plugin:feature-lib <name> [--shape=async]`): creates
  the complete feature-library shape from `.claude/skills/feature-lib` — files,
  `scope:` tag registered in `depConstraints` (anchored on marker comments in
  `eslint.base.config.mjs`), path alias, Vitest `test` target with the
  95/90/90/95 floor, and i18n keys seeded in all four bundles. Only the app
  route stays manual, because features compose through the app.

### Changed

- Restructured the README for first-time readers: a concrete value pitch and
  feature grid above the fold, app screenshots (light and dark), a Mermaid
  diagram of the boundary graph in place of prose-only rules, a curated table of
  contents, a "who this is for" section, and the long project tree and
  configuration deep-dive collapsed behind `<details>`. The boundary table also
  regained the `theme`/`ui` allowances for `scope:profile` it had drifted away
  from.
- Bumped Angular to 22.1 (framework `22.1.1`, CLI/build toolchain `22.1.3`), the
  Nx group to `23.1.1`, and assorted patch releases (`firebase`,
  `typescript-eslint`, `ts-node`, `@swc-node/register`, `postcss`). TypeScript
  stays on 6.0.x because Angular 22.1 peers on `>=6.0 <6.1`, and
  `@angular/platform-browser-dynamic` stays installed because Spectator imports
  `BrowserDynamicTestingModule` from it at runtime despite not declaring the
  dependency. The lockfile was regenerated in the process.
- Bumped `@ngrx/*` from `22.0.0-beta.0` to `22.0.0-rc.0` — the last prerelease
  step before the stable NgRx 22. No source changes were needed.
- **Migrated unit testing from Jest to Vitest**, through Angular's official
  `@angular/build:unit-test` builder. Per-project `jest.config.*` and
  `src/test-setup.ts` are gone; each `test` target now carries its coverage
  options in `project.json`, with the shared pieces (`buildTarget`,
  `watch: false`, caching, the `generate-config` dependency) in `nx.json`
  `targetDefaults`. Specs import Spectator from `@ngneat/spectator/vitest` and use
  `vi.*` in place of `jest.*`. Two behavioural notes: workspace aliases
  (`@libs/*`) cannot be module-mocked because the Angular build resolves them
  before Vitest sees them, and coverage is measured from the test bundle, so files
  no spec imports are invisible to the report — the `@libs/ui` and
  `@libs/translation` floors were re-based against the new measurement.
- Moved `docs/skills/*.md` to `.claude/skills/<name>/SKILL.md` with `name` and
  `description` frontmatter. They were plain markdown that nothing pointed an agent
  at; as skills they load on demand when the task matches. All inbound links
  updated.
- Rewrote the analytics skill, which still documented the removed `AnalyticsService`
  rather than the `ANALYTICS` token, and refreshed the tag graph in the
  module-boundaries skill with the analytics and settings scopes.
- `.claude/settings.local.json` is now git-ignored — it holds absolute paths from
  whichever machine wrote it.

- Renamed `apps/genai-app` to `apps/demo-app` and `genai.paths.ts` to
  `api.paths.ts`. The workspace contains nothing generative-AI specific; the name
  promised otherwise.
- `GlobalErrorHandler` depends on the `ANALYTICS` token instead of a concrete
  Firebase service.
- `libs/shared/ui/src/lib/header/` moved to `organisms/header/`.

### Fixed

- Disabled critical-CSS inlining (`inlineCritical: false`) in the production
  build. Beasties defers the stylesheet with an inline `onload` handler, which
  the CSP in `hosting/firebase.json` blocks — leaving the deployed stylesheet
  stuck at `media="print"` and non-critical styles unapplied.

### Removed

- `nxCloudId` from `nx.json`. The workspace was never claimed, so every Nx command
  printed a 401 warning and the remote cache never worked — and a fork should not
  inherit someone else's Nx Cloud identity any more than a Firebase project id.
  Connect your own with `npx nx connect` if you want distributed caching.
- Root-level `tsconfig.app.json` and `tsconfig.spec.json` — generator leftovers
  covering a `src/` tree that does not exist at the workspace root.
- `AnalyticsService` from `@libs/ui` — replaced by `ANALYTICS` +
  `@libs/analytics-firebase`.
- `apps/demo-app/src/assets/icons/delhaize-logo.png` — an unreferenced third-party
  logo left over from an unrelated project.
- `hosting/.firebaserc` from version control. It is generated now, and carried a
  placeholder project id before.

## [1.0.0]

Initial public version: Nx 23 workspace, Angular 22 standalone + zoneless, NgRx
SignalStore, ngx-translate, Tailwind 4, Jest + Spectator, Firebase Hosting.

[Unreleased]: https://github.com/myvictorlife/base-angular-monorepo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/myvictorlife/base-angular-monorepo/releases/tag/v1.0.0
