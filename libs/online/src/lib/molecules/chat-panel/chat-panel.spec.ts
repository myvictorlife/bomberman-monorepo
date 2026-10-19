import { CHAT_MAX_LENGTH, ChatMessage, REACTIONS } from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { ChatPanelComponent } from './chat-panel';

const said = (
  id: number,
  author: string,
  text: string,
  role: 'playing' | 'queued' | 'watching' = 'watching',
): ChatMessage => ({
  id,
  at: 0,
  author: { id: author, name: author.toUpperCase(), role },
  text,
});

describe('ChatPanelComponent', () => {
  let spectator: Spectator<ChatPanelComponent>;
  const createComponent = createComponentFactory({
    component: ChatPanelComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => (spectator = createComponent()));

  /** `output()` is an emitter, not a spy: subscribe a spy to it. */
  const watch = (name: string) => {
    const spy = vi.fn();
    (
      spectator.component[
        name as keyof typeof spectator.component
      ] as unknown as { subscribe(fn: (v: unknown) => void): void }
    ).subscribe(spy);
    return spy;
  };

  const type = (text: string) =>
    spectator.typeInElement(text, '[data-testid="chat-input"]');

  it('starts empty, and lists lines with who wrote them and what they were doing', () => {
    expect(spectator.query('[data-testid="chat-empty"]')).toExist();

    spectator.setInput('messages', [
      said(1, 'ana', 'boa!', 'playing'),
      said(2, 'me', 'valeu'),
    ]);
    spectator.setInput('myId', 'me');

    const lines = spectator.queryAll('[data-testid="chat-line"]');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveText('ANA');
    expect(lines[0]).toHaveText('ONLINE.CHAT.ROLE.playing');
    expect(lines[0]).toHaveText('boa!');
    expect(lines[1]).toHaveClass('chat__line--me');
  });

  it('docks beside the arena on request', () => {
    expect(spectator.query('[data-testid="chat-panel"]')).not.toHaveClass(
      'chat--dock',
    );
    spectator.setInput('dock', true);
    expect(spectator.query('[data-testid="chat-panel"]')).toHaveClass(
      'chat--dock',
    );
  });

  it('writes the room’s own lines as events', () => {
    spectator.setInput('messages', [
      { id: 1, at: 0, author: null, event: { type: 'round-won', name: 'Ana' } },
      { id: 2, at: 0, author: null, event: { type: 'round-draw' } },
      {
        id: 3,
        at: 0,
        author: null,
        event: { type: 'champion-stays', name: 'Ana', streak: 2 },
      },
    ]);

    const events = spectator.queryAll('[data-testid="chat-event"]');
    expect(events[0]).toHaveText('ONLINE.CHAT.EVENT.round-won');
    expect(events[1]).toHaveText('ONLINE.CHAT.EVENT.round-draw');
    expect(events[2]).toHaveText('ONLINE.CHAT.EVENT.champion-stays');
  });

  it('sends a trimmed line on Enter and clears the box; never an empty one', () => {
    const send = watch('send');

    spectator.dispatchFakeEvent('[data-testid="chat-form"]', 'submit');
    expect(send).not.toHaveBeenCalled();
    expect(
      spectator.query<HTMLButtonElement>('[data-testid="chat-send"]')?.disabled,
    ).toBe(true);

    type('  gg  ');
    spectator.dispatchFakeEvent('[data-testid="chat-form"]', 'submit');

    expect(send).toHaveBeenCalledWith('gg');
    expect(spectator.component.draft()).toBe('');
  });

  it('counts down the characters left near the limit, an emoji as one', () => {
    type('x');
    expect(spectator.query('[data-testid="chat-count"]')).not.toExist();

    type('🔥'.repeat(CHAT_MAX_LENGTH - 5));
    expect(spectator.query('[data-testid="chat-count"]')).toHaveText('5');

    spectator.component.onInput('x'.repeat(CHAT_MAX_LENGTH + 1));
    spectator.detectChanges();
    expect(spectator.component.canSend()).toBe(false);
  });

  it('says why someone cannot write, but still lets them react', () => {
    const react = watch('react');
    spectator.setInput('blocked', 'sign-in');

    expect(spectator.query('[data-testid="chat-form"]')).not.toExist();
    expect(spectator.query('[data-testid="chat-blocked"]')).toHaveText(
      'ONLINE.CHAT.BLOCKED.sign-in',
    );

    const buttons = spectator.queryAll<HTMLButtonElement>(
      '[data-testid="chat-react"]',
    );
    expect(buttons).toHaveLength(REACTIONS.length);
    spectator.click(buttons[0]);
    expect(react).toHaveBeenCalledWith(REACTIONS[0]);

    spectator.setInput('blocked', 'offline');
    expect(
      spectator.queryAll<HTMLButtonElement>('[data-testid="chat-react"]')[0]
        .disabled,
    ).toBe(true);
  });

  it('gives an admin remove and silence on other people’s lines', () => {
    const remove = watch('remove');
    const mute = watch('mute');
    spectator.setInput('messages', [
      said(7, 'troll', 'spam'),
      said(8, 'me', 'mine'),
    ]);
    spectator.setInput('myId', 'me');
    expect(spectator.query('[data-testid="chat-remove"]')).not.toExist();

    spectator.setInput('admin', true);
    expect(spectator.queryAll('[data-testid="chat-remove"]')).toHaveLength(1);

    spectator.click('[data-testid="chat-remove"]');
    spectator.click('[data-testid="chat-mute"]');
    expect(remove).toHaveBeenCalledWith(7);
    expect(mute).toHaveBeenCalledWith('troll');
  });

  it('shows a refusal from the server', () => {
    spectator.setInput('error', 'chat-slow-down');

    expect(spectator.query('[data-testid="chat-error"]')).toHaveText(
      'ONLINE.SERVER_ERROR.chat-slow-down',
    );
  });

  it('follows new lines unless the reader scrolled up', () => {
    const list = spectator.query<HTMLElement>(
      '[data-testid="chat-list"]',
    ) as HTMLElement;
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      value: 1_000,
    });
    Object.defineProperty(list, 'clientHeight', {
      configurable: true,
      value: 200,
    });

    spectator.setInput('messages', [said(1, 'ana', 'a')]);
    expect(list.scrollTop).toBe(1_000);

    list.scrollTop = 100;
    spectator.dispatchFakeEvent(list, 'scroll');
    spectator.setInput('messages', [said(1, 'ana', 'a'), said(2, 'ana', 'b')]);
    expect(list.scrollTop).toBe(100);
  });
});
