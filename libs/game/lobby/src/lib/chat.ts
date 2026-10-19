import {
  CHAT_BACKLOG,
  CHAT_HISTORY,
  CHAT_MAX_AGE_MS,
  ChatEvent,
  ChatMessage,
  ChatRole,
} from '@libs/game-protocol';

/** At least this long between two messages of one account. */
export const CHAT_MIN_GAP_MS = 2_000;
/** And no more than {@link CHAT_BURST} of them within this window. */
export const CHAT_BURST_WINDOW_MS = 15_000;
export const CHAT_BURST = 5;
/** The same text again within this long is refused. */
export const CHAT_REPEAT_MS = 30_000;
/** Reactions: no more than {@link REACTION_BURST} per sender within this window. */
export const REACTION_WINDOW_MS = 3_000;
export const REACTION_BURST = 4;

export interface ChatAuthor {
  id: string;
  name: string;
  role: ChatRole;
}

/** Why a message was not posted. */
export type ChatRefusal = 'chat-slow-down' | 'chat-muted';

/**
 * The room's chat, in memory: the last {@link CHAT_HISTORY} messages and
 * nothing else, so a restart forgets it all. Owns every limit — how often an
 * account may write, repeats, reactions, who an admin silenced — so the room
 * class only passes messages through.
 */
export class Chat {
  private messages: ChatMessage[] = [];
  private nextId = 1;
  /** Recent send times per account, newest last, within the burst window. */
  private readonly sent = new Map<string, number[]>();
  private readonly lastText = new Map<string, { text: string; at: number }>();
  private readonly reacted = new Map<string, number[]>();
  private readonly muted = new Set<string>();

  /** Posts what a person wrote, already validated by `parseChatText`. */
  post(
    author: ChatAuthor,
    text: string,
    now: number,
  ): ChatMessage | ChatRefusal {
    if (this.muted.has(author.id)) return 'chat-muted';
    const times = recent(this.sent.get(author.id), now - CHAT_BURST_WINDOW_MS);
    const last = times[times.length - 1];
    if (last !== undefined && now - last < CHAT_MIN_GAP_MS)
      return 'chat-slow-down';
    if (times.length >= CHAT_BURST) return 'chat-slow-down';
    const previous = this.lastText.get(author.id);
    if (
      previous &&
      previous.text.toLowerCase() === text.toLowerCase() &&
      now - previous.at < CHAT_REPEAT_MS
    ) {
      return 'chat-slow-down';
    }
    this.sent.set(author.id, [...times, now]);
    this.lastText.set(author.id, { text, at: now });
    return this.add({ id: 0, at: now, author: { ...author }, text });
  }

  /** A line from the room itself: a round won, someone getting in from the border. */
  announce(event: ChatEvent, now: number): ChatMessage {
    return this.add({ id: 0, at: now, author: null, event });
  }

  /** What a newcomer receives: the last {@link CHAT_BACKLOG}, none older than {@link CHAT_MAX_AGE_MS}. */
  backlog(now: number): ChatMessage[] {
    return this.messages
      .filter((m) => now - m.at <= CHAT_MAX_AGE_MS)
      .slice(-CHAT_BACKLOG);
  }

  /** Removes one message; returns whether it was there. */
  remove(id: number): boolean {
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => m.id !== id);
    return this.messages.length !== before;
  }

  /** Silences an account until the server restarts, and removes what it wrote. Returns the removed ids. */
  mute(accountId: string): number[] {
    this.muted.add(accountId);
    const ids = this.messages
      .filter((m) => m.author?.id === accountId)
      .map((m) => m.id);
    this.messages = this.messages.filter((m) => m.author?.id !== accountId);
    return ids;
  }

  isMuted(accountId: string): boolean {
    return this.muted.has(accountId);
  }

  /**
   * Whether a reaction from `senderId` (an account, or a connection for
   * someone not signed in) may go out now. Reactions are never kept.
   */
  react(senderId: string, now: number): boolean {
    if (this.muted.has(senderId)) return false;
    const times = recent(this.reacted.get(senderId), now - REACTION_WINDOW_MS);
    if (times.length >= REACTION_BURST) return false;
    this.reacted.set(senderId, [...times, now]);
    return true;
  }

  /** Drops what is kept about a connection that left without an account. */
  forget(senderId: string): void {
    this.reacted.delete(senderId);
  }

  private add(message: ChatMessage): ChatMessage {
    const kept = { ...message, id: this.nextId++ };
    this.messages = [...this.messages, kept].slice(-CHAT_HISTORY);
    return kept;
  }
}

function recent(times: number[] | undefined, since: number): number[] {
  return (times ?? []).filter((t) => t > since);
}
