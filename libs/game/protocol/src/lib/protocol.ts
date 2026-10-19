import {
  CHARACTERS,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  Direction,
  GameEvent,
  GameState,
  isCharacterId,
  isPlayerColorId,
  MAX_PLAYERS,
  PlayerColorId,
  TICK_RATE,
} from '@libs/game-core';

/**
 * The contract between the game server and the browser. Both sides import this
 * file, so a message can never mean one thing on the server and another in the
 * client. Everything here is plain data: it travels as JSON over the socket.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The one public room of the first version. */
export const ARENA_ROOM = 'arena';

/** Where the game server listens unless `PORT` says otherwise. */
export const DEFAULT_GAME_SERVER_PORT = 8086;

/**
 * How long a dropped connection keeps its place — the character in the round,
 * or the spot in the queue. A reload comes back well within it.
 */
export const RECONNECT_GRACE_MS = 15_000;

/** Tuning of a room. The public room uses {@link PUBLIC_ROOM_RULES}; rooms people create later pick their own. */
export interface RoomRules {
  /** A round starts at once when this many are queued. */
  maxPlayers: number;
  /** With at least this many queued, the countdown runs. */
  minPlayers: number;
  /** How long the countdown waits for more players before starting with whoever is there. */
  countdownMs: number;
  /** How long the result stays on screen before the next round can be set up. */
  resultsMs: number;
  /**
   * How many of those next in line stand outside the arena during a round,
   * throwing bombs in — a kill puts them in the round in the victim's place.
   * `0` keeps the queue waiting quietly.
   */
  outsiders: number;
  /** How long a round lasts before the clock runs out; `0` is no clock. */
  roundTimerMs: number;
  /** When the clock runs out: walls fall in a spiral until one is left; off, time-up is a draw. */
  closingWalls: boolean;
  /**
   * The winner plays the next round too, with the next in line, until this
   * many wins in a row; then they go to the back like everyone else. `0`: no
   * one stays, the round's players all go to the back.
   */
  winnerStays: number;
}

/**
 * A rule the room's admin can change from the page, and the values offered.
 * The page draws one control per entry, so a new rule is one line here plus
 * its `ONLINE.RULES.<KEY>` strings — nothing else to wire.
 */
export interface RuleField {
  key: keyof RoomRules;
  kind: 'number' | 'boolean';
  /** The numbers to pick from, in order. A rule never takes a free value. */
  options?: readonly number[];
  /** How a number reads: a count, milliseconds shown as seconds, or wins in a row (`0` as "off" for both). */
  unit?: 'count' | 'seconds' | 'wins';
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const RULE_FIELDS: readonly RuleField[] = [
  {
    key: 'outsiders',
    kind: 'number',
    options: range(0, MAX_PLAYERS),
    unit: 'count',
  },
  {
    key: 'minPlayers',
    kind: 'number',
    options: range(2, MAX_PLAYERS),
    unit: 'count',
  },
  {
    key: 'maxPlayers',
    kind: 'number',
    options: range(2, MAX_PLAYERS),
    unit: 'count',
  },
  {
    key: 'countdownMs',
    kind: 'number',
    options: [5_000, 10_000, 15_000, 30_000, 60_000],
    unit: 'seconds',
  },
  {
    key: 'resultsMs',
    kind: 'number',
    options: [3_000, 5_000, 10_000],
    unit: 'seconds',
  },
  {
    key: 'roundTimerMs',
    kind: 'number',
    options: [0, 60_000, 120_000, 180_000, 300_000, 600_000],
    unit: 'seconds',
  },
  { key: 'closingWalls', kind: 'boolean' },
  {
    key: 'winnerStays',
    kind: 'number',
    options: [0, 2, 3, 5, 10],
    unit: 'wins',
  },
];

/**
 * A change of rules from an admin, checked against {@link RULE_FIELDS}: only
 * known keys, only offered values, and never fewer `maxPlayers` than
 * `minPlayers`. Returns the full rules with the change applied, or `null`.
 */
export function parseRules(
  value: unknown,
  current: RoomRules,
): RoomRules | null {
  if (!isRecord(value)) return null;
  const next: RoomRules = { ...current };
  for (const [key, raw] of Object.entries(value)) {
    const field = RULE_FIELDS.find((f) => f.key === key);
    if (!field) return null;
    if (field.kind === 'boolean') {
      if (typeof raw !== 'boolean') return null;
      (next as unknown as Record<string, boolean>)[key] = raw;
    } else {
      if (typeof raw !== 'number' || !field.options?.includes(raw)) return null;
      (next as unknown as Record<string, number>)[key] = raw;
    }
  }
  return next.minPlayers <= next.maxPlayers ? next : null;
}

export const PUBLIC_ROOM_RULES: RoomRules = {
  maxPlayers: MAX_PLAYERS,
  minPlayers: 2,
  countdownMs: 15_000,
  resultsMs: 5_000,
  outsiders: 5,
  roundTimerMs: 180_000,
  closingWalls: true,
  winnerStays: 5,
};

/**
 * - `waiting`: fewer than `minPlayers` queued.
 * - `countdown`: enough to play; the round starts when it ends or the room is full.
 * - `playing`: a round is on; anyone can watch, newcomers queue for the next one.
 * - `results`: the round is decided; the winner is on screen.
 */
export type LobbyPhase = 'waiting' | 'countdown' | 'playing' | 'results';

/** Someone in the queue or in the round. `id` is the account id, so one account holds one place. */
export interface Seat {
  id: string;
  name: string;
  characterId: CharacterId;
  /** The colour on their profile when they joined; the round may give the closest free one. */
  color?: PlayerColorId;
}

/** Connected but neither playing nor queued: the audience. */
export interface Watchers {
  /** Signed-in viewers, by name, one entry per account. */
  names: string[];
  /** Viewers who are not signed in. */
  anonymous: number;
}

export const NO_WATCHERS: Watchers = { names: [], anonymous: 0 };

export interface LobbySnapshot {
  phase: LobbyPhase;
  /** In order: the first `maxPlayers` play the next round. */
  queue: Seat[];
  /** Who is in the round being played (or just decided). */
  players: Seat[];
  /** Server clock, epoch ms. The client turns it into seconds left with {@link serverOffset}. */
  countdownEndsAt: number | null;
  resultsEndsAt: number | null;
  winnerId: string | null;
  /**
   * Who won the last round and keeps a seat for the next, with their wins in
   * a row; `null` when nobody does (a draw, the rule is off, or the limit was reached).
   */
  champion?: Champion | null;
  /** The server's clock when the snapshot was taken. */
  now: number;
  rules: RoomRules;
  /** Rules an admin changed during a round: they apply when the next one is set up. */
  nextRules?: RoomRules | null;
  watchers: Watchers;
}

export interface Champion {
  id: string;
  /** Wins in a row, this one included. */
  streak: number;
}

/** What the room says about itself to anyone who asks (`GET /status`): who is around right now. */
export interface RoomStatus {
  /** Connections to the room: players, the queue and the audience. */
  online: number;
  phase: LobbyPhase;
  /** In the round being played. */
  playing: number;
  /** Waiting for the next one. */
  queued: number;
}

export interface RankingEntry {
  id: string;
  name: string;
  wins: number;
  matches: number;
  /**
   * The face on the podium: their favourite character, or who they last
   * played as; absent for a record from before faces were kept.
   */
  characterId?: CharacterId;
  /** The colour they picked; absent means none, and the podium uses its own. */
  color?: PlayerColorId;
}

/** What the server knows about the signed-in account. */
export interface PlayerProfile extends RankingEntry {
  /** `true` once they picked the name themselves; until then it follows the sign-in. */
  nameChosen: boolean;
  /** The character they play as, kept on the account so it follows them across devices. */
  favoriteCharacterId?: CharacterId;
  /** Distinct visits, counted when someone comes back after a while away. */
  visits: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** `true` when this is not the first visit. */
  returning: boolean;
  /** 1-based place in the ranking, `null` before the first win. */
  rank: number | null;
}

/** The server simulates at 60 Hz and sends every third tick: 20 frames a second. */
export const FRAME_EVERY_TICKS = 3;
export const FRAME_INTERVAL_MS = (1000 / TICK_RATE) * FRAME_EVERY_TICKS;

/** A frame of the round in play, sent {@link FRAME_INTERVAL_MS} apart. */
export interface FrameMessage {
  /** Counts the rounds of the room: a different number is a different round to draw. */
  round: number;
  state: GameState;
  /** Everything that happened since the previous frame — sounds and effects read these. */
  events: GameEvent[];
}

export type ServerErrorCode =
  | 'auth-required'
  | 'email-not-verified'
  | 'invalid-token'
  | 'already-queued'
  | 'already-playing'
  | 'forbidden'
  | 'bad-message'
  /** A chat message too soon after the last ones, or the same one again. */
  | 'chat-slow-down'
  /** An admin silenced this account in the chat until the server restarts. */
  | 'chat-muted';

/** A player's name on the ranking, in characters (an emoji is one). */
export const PLAYER_NAME_LENGTH = { min: 2, max: 20 } as const;

/**
 * What a signed-in player may change about themselves (`PUT /me`). Every field
 * is optional; `color: null` clears the colour.
 */
export interface ProfileUpdate {
  name?: string;
  favoriteCharacterId?: CharacterId;
  color?: PlayerColorId | null;
}

/**
 * Why `/me` refused: no valid sign-in, an unconfirmed e-mail (a name on the
 * public ranking takes a confirmed account), a body that is not a
 * {@link ProfileUpdate}, or a name someone else has.
 */
export type ProfileUpdateError =
  | 'auth-required'
  | 'email-not-verified'
  | 'bad-request'
  | 'name-taken';

/** The longest chat message, in characters. */
export const CHAT_MAX_LENGTH = 140;
/** How many chat messages the room keeps; older ones are forgotten. Nothing is written to disk. */
export const CHAT_HISTORY = 50;
/** How many of those a newcomer receives on arrival. */
export const CHAT_BACKLOG = 20;
/** A message older than this is left out of the backlog, even when the room has been quiet. */
export const CHAT_MAX_AGE_MS = 10 * 60_000;

/** What someone was doing in the room when they wrote: shown next to the name. */
export type ChatRole = 'playing' | 'queued' | 'watching';

/** A line the room writes itself, translated by the page. */
export type ChatEvent =
  | { type: 'round-won'; name: string }
  /** Won, and plays the next round too. */
  | { type: 'champion-stays'; name: string; streak: number }
  /** Won again, but that was the last win in a row the room allows: to the back of the line. */
  | { type: 'champion-limit'; name: string; streak: number }
  | { type: 'round-draw' }
  | { type: 'outsider-entered'; name: string };

export interface ChatMessage {
  /** Grows with each message of the room; an admin removes one by it. */
  id: number;
  /** Server clock, epoch ms. */
  at: number;
  /** `null` for a line from the room itself. */
  author: { id: string; name: string; role: ChatRole } | null;
  /** What a person wrote; absent on a line from the room. */
  text?: string;
  /** What happened, on a line from the room. */
  event?: ChatEvent;
}

/** The reactions offered: a fixed set, so nothing but these ever floats over the arena. */
export const REACTIONS = ['🔥', '😂', '💣', '👏', '😱', '👀'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface ReactionMessage {
  emoji: Reaction;
}

/** Message types, client → server. */
export const CLIENT_MESSAGE = {
  /** Sign in on this connection; answered with `profile` or `error`. */
  hello: 'hello',
  /** Signing out on purpose: give up the place now, no grace period. */
  signOut: 'sign-out',
  joinQueue: 'queue:join',
  leaveQueue: 'queue:leave',
  input: 'input',
  /** An admin changes the room's rules; answered with `lobby` (or `error`). */
  setRules: 'rules:set',
  /** A signed-in account with a confirmed e-mail writes in the chat. */
  chatSend: 'chat:send',
  /** Anyone connected sends one of {@link REACTIONS}; it floats over the arena, never kept. */
  react: 'react',
  /** An admin removes a message. */
  chatDelete: 'chat:delete',
  /** An admin silences an account in the chat, and removes what it wrote. */
  chatMute: 'chat:mute',
} as const;

/** Message types, server → client. */
export const SERVER_MESSAGE = {
  lobby: 'lobby',
  frame: 'frame',
  ranking: 'ranking',
  profile: 'profile',
  error: 'error',
  /** After `hello`: whether this account may change the room's rules. */
  admin: 'admin',
  /** On arrival: the last {@link CHAT_BACKLOG} messages, oldest first. */
  chatHistory: 'chat:history',
  /** A new message. */
  chat: 'chat',
  /** Messages an admin removed, by id. */
  chatRemoved: 'chat:removed',
  /** Someone reacted. */
  reaction: 'reaction',
} as const;

export interface HelloMessage {
  /** A Firebase ID token. */
  token: string;
}

export interface JoinQueueMessage {
  characterId: CharacterId;
}

export interface InputMessage {
  /** The direction held now, or `null` to stand still. Sent when it changes. */
  direction: Direction | null;
  /** A press of the bomb button (edge) — from the border, a throw. */
  bomb?: boolean;
  /** A press of the mount-ability button (edge). */
  ability?: boolean;
  /** A press of the detonate button, for remote bombs (edge). */
  detonate?: boolean;
}

export interface ErrorMessage {
  code: ServerErrorCode;
}

export interface AdminMessage {
  admin: boolean;
}

export interface SetRulesMessage {
  rules: Partial<RoomRules>;
}

export interface ChatSendMessage {
  text: string;
}

export interface ChatDeleteMessage {
  id: number;
}

export interface ChatMuteMessage {
  /** The account to silence. */
  accountId: string;
}

export interface ChatRemovedMessage {
  ids: number[];
}

const DIRECTIONS: readonly string[] = ['up', 'down', 'left', 'right'];

// Everything below runs on the server against what a client sent: never trust
// the shape, only what these functions return.

export function parseHello(value: unknown): HelloMessage | null {
  if (!isRecord(value) || typeof value['token'] !== 'string') return null;
  const token = value['token'].trim();
  return token.length > 0 && token.length < 8192 ? { token } : null;
}

/** Unknown characters fall back to the default one rather than failing the join. */
export function parseJoinQueue(value: unknown): JoinQueueMessage {
  const id = isRecord(value) ? value['characterId'] : undefined;
  const known = CHARACTERS.find((c) => c.id === id);
  return { characterId: known?.id ?? DEFAULT_CHARACTER_ID };
}

export function parseInput(value: unknown): InputMessage | null {
  if (!isRecord(value)) return null;
  const direction = value['direction'];
  if (
    direction !== null &&
    !(typeof direction === 'string' && DIRECTIONS.includes(direction))
  ) {
    return null;
  }
  return {
    direction: direction as Direction | null,
    bomb: value['bomb'] === true,
    ability: value['ability'] === true,
    detonate: value['detonate'] === true,
  };
}

/**
 * Text a player wrote, as it may be kept: control and invisible characters
 * become spaces, and runs of spaces collapse.
 */
function cleanText(raw: string): string {
  return raw
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name cleaned like a chat line, within {@link PLAYER_NAME_LENGTH}; `null` otherwise. */
export function parsePlayerName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = cleanText(value);
  const length = [...name].length;
  return length >= PLAYER_NAME_LENGTH.min && length <= PLAYER_NAME_LENGTH.max
    ? name
    : null;
}

/**
 * A {@link ProfileUpdate} with every field checked; `null` when anything sent
 * is wrong, or nothing was sent — a bad field never half-applies.
 */
export function parseProfileUpdate(value: unknown): ProfileUpdate | null {
  if (!isRecord(value)) return null;
  const update: ProfileUpdate = {};
  if ('name' in value) {
    const name = parsePlayerName(value['name']);
    if (name === null) return null;
    update.name = name;
  }
  if ('favoriteCharacterId' in value) {
    const id = value['favoriteCharacterId'];
    if (typeof id !== 'string' || !isCharacterId(id)) return null;
    update.favoriteCharacterId = id;
  }
  if ('color' in value) {
    const color = value['color'];
    if (color !== null && !isPlayerColorId(color)) return null;
    update.color = color;
  }
  return Object.keys(update).length > 0 ? update : null;
}

/**
 * A chat line as it may be kept: control characters and line breaks become
 * spaces, runs of spaces collapse, and it must fit {@link CHAT_MAX_LENGTH}
 * (counted in characters, so an emoji is one). `null` when nothing is left
 * or it is too long — the page never sends one longer.
 */
export function parseChatText(value: unknown): string | null {
  const raw = isRecord(value) ? value['text'] : undefined;
  if (typeof raw !== 'string') return null;
  const text = cleanText(raw);
  return text && [...text].length <= CHAT_MAX_LENGTH ? text : null;
}

export function parseReaction(value: unknown): Reaction | null {
  const emoji = isRecord(value) ? value['emoji'] : undefined;
  return REACTIONS.find((r) => r === emoji) ?? null;
}

export function parseChatDelete(value: unknown): ChatDeleteMessage | null {
  const id = isRecord(value) ? value['id'] : undefined;
  return typeof id === 'number' && Number.isInteger(id) && id > 0
    ? { id }
    : null;
}

export function parseChatMute(value: unknown): ChatMuteMessage | null {
  const accountId = isRecord(value) ? value['accountId'] : undefined;
  return typeof accountId === 'string' &&
    accountId.length > 0 &&
    accountId.length <= 128
    ? { accountId }
    : null;
}

/**
 * How far the server clock is ahead of this one, from a snapshot just received.
 * Network delay makes it slightly off, which is fine for a countdown in seconds.
 */
export function serverOffset(
  snapshot: Pick<LobbySnapshot, 'now'>,
  localNow: number,
): number {
  return snapshot.now - localNow;
}

/** Whole seconds left until `endsAt` (server clock), never negative. */
export function secondsLeft(
  endsAt: number | null,
  localNow: number,
  offset: number,
): number {
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - (localNow + offset)) / 1000));
}
