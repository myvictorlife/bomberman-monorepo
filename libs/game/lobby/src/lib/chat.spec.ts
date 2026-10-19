import {
  CHAT_BACKLOG,
  CHAT_HISTORY,
  CHAT_MAX_AGE_MS,
} from '@libs/game-protocol';
import {
  Chat,
  CHAT_BURST,
  CHAT_BURST_WINDOW_MS,
  CHAT_MIN_GAP_MS,
  CHAT_REPEAT_MS,
  ChatAuthor,
  REACTION_BURST,
  REACTION_WINDOW_MS,
} from './chat';

const ana: ChatAuthor = { id: 'ana', name: 'Ana', role: 'watching' };
const bia: ChatAuthor = { id: 'bia', name: 'Bia', role: 'playing' };

describe('Chat', () => {
  it('posts a message with a growing id and the author as they were', () => {
    const chat = new Chat();

    const first = chat.post(ana, 'oi', 1_000);
    const second = chat.post(bia, 'olá', 1_000);

    expect(first).toEqual({ id: 1, at: 1_000, author: ana, text: 'oi' });
    expect(second).toMatchObject({ id: 2, author: { role: 'playing' } });
    expect(chat.backlog(1_000)).toHaveLength(2);
  });

  it('keeps an account to one message every two seconds', () => {
    const chat = new Chat();
    chat.post(ana, 'a', 0);

    expect(chat.post(ana, 'b', CHAT_MIN_GAP_MS - 1)).toBe('chat-slow-down');
    expect(chat.post(bia, 'b', 1)).not.toBe('chat-slow-down');
    expect(chat.post(ana, 'b', CHAT_MIN_GAP_MS)).toMatchObject({ text: 'b' });
  });

  it('caps a burst within the window, then lets it go once the window moves', () => {
    const chat = new Chat();
    for (let i = 0; i < CHAT_BURST; i++)
      chat.post(ana, `m${i}`, i * CHAT_MIN_GAP_MS);
    const after = CHAT_BURST * CHAT_MIN_GAP_MS;

    expect(chat.post(ana, 'more', after)).toBe('chat-slow-down');
    expect(chat.post(ana, 'more', CHAT_BURST_WINDOW_MS + 1)).toMatchObject({
      text: 'more',
    });
  });

  it('refuses the same text again for a while, whatever the case', () => {
    const chat = new Chat();
    chat.post(ana, 'GG', 0);

    expect(chat.post(ana, 'gg', CHAT_MIN_GAP_MS)).toBe('chat-slow-down');
    expect(chat.post(ana, 'gg', CHAT_REPEAT_MS)).toMatchObject({ text: 'gg' });
  });

  it('keeps only the last messages, and hands newcomers a short, recent backlog', () => {
    const chat = new Chat();
    for (let i = 0; i < CHAT_HISTORY + 5; i++)
      chat.announce({ type: 'round-draw' }, i);

    const backlog = chat.backlog(CHAT_HISTORY + 5);
    expect(backlog).toHaveLength(CHAT_BACKLOG);
    expect(backlog.at(-1)?.id).toBe(CHAT_HISTORY + 5);
    expect(chat.backlog(CHAT_HISTORY + 5 + CHAT_MAX_AGE_MS + 100)).toEqual([]);
  });

  it('announces what happens in the room with no author', () => {
    const chat = new Chat();

    expect(chat.announce({ type: 'round-won', name: 'Ana' }, 5)).toEqual({
      id: 1,
      at: 5,
      author: null,
      event: { type: 'round-won', name: 'Ana' },
    });
  });

  it('lets an admin remove a message', () => {
    const chat = new Chat();
    const message = chat.post(ana, 'x', 0);
    const id = typeof message === 'string' ? 0 : message.id;

    expect(chat.remove(id)).toBe(true);
    expect(chat.remove(id)).toBe(false);
    expect(chat.backlog(0)).toEqual([]);
  });

  it('silences an account and removes what it wrote', () => {
    const chat = new Chat();
    chat.post(ana, 'spam', 0);
    chat.post(bia, 'ok', 0);

    expect(chat.mute('ana')).toEqual([1]);
    expect(chat.isMuted('ana')).toBe(true);
    expect(chat.post(ana, 'again', 60_000)).toBe('chat-muted');
    expect(chat.react('ana', 60_000)).toBe(false);
    expect(chat.backlog(0).map((m) => m.text)).toEqual(['ok']);
  });

  it('limits reactions per sender, and forgets a sender that left', () => {
    const chat = new Chat();
    for (let i = 0; i < REACTION_BURST; i++)
      expect(chat.react('s1', i)).toBe(true);

    expect(chat.react('s1', REACTION_BURST)).toBe(false);
    expect(chat.react('s2', REACTION_BURST)).toBe(true);
    expect(chat.react('s1', REACTION_WINDOW_MS + REACTION_BURST)).toBe(true);
    chat.forget('s1');
    for (let i = 0; i < REACTION_BURST; i++)
      expect(chat.react('s1', REACTION_WINDOW_MS + 10)).toBe(true);
  });
});
