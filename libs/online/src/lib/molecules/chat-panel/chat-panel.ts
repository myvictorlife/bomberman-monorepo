import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  CHAT_MAX_LENGTH,
  ChatMessage,
  Reaction,
  REACTIONS,
  ServerErrorCode,
} from '@libs/game-protocol';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { JoinBlock } from '../queue-panel/queue-panel';

/** How close to the bottom (px) still counts as reading the latest lines. */
const STICK_PX = 48;

/**
 * The room's conversation and its reactions. Everyone reads and reacts;
 * writing takes a confirmed account (`blocked` says why not). An admin gets a
 * remove and a silence button on each line. Presentational: the limits are
 * the server's, this only keeps a line within {@link CHAT_MAX_LENGTH}.
 *
 * Docked (`dock`), it fills whatever height its host gives it and the lines
 * rise from the bottom, the way a live-stream chat reads beside the video.
 */
@Component({
  selector: 'lib-chat-panel',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './chat-panel.html',
  styleUrls: ['./chat-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dock]': 'dock()' },
})
export class ChatPanelComponent {
  readonly messages = input<ChatMessage[]>([]);
  readonly myId = input<string | null>(null);
  readonly admin = input(false);
  /** Why this viewer cannot write; `null` when they can. Reactions only need a connection. */
  readonly blocked = input<JoinBlock>(null);
  readonly error = input<ServerErrorCode | null>(null);
  /** Fill the host's height instead of showing a fixed number of lines. */
  readonly dock = input(false);

  readonly send = output<string>();
  readonly react = output<Reaction>();
  readonly remove = output<number>();
  readonly mute = output<string>();

  readonly reactions = REACTIONS;
  readonly maxLength = CHAT_MAX_LENGTH;
  readonly draft = signal('');
  /** The box has focus: the keys are the chat's, and the hint says how to get them back. */
  readonly typing = signal(false);
  /** Characters left, counted the way the server counts them (an emoji is one). */
  readonly left = computed(() => CHAT_MAX_LENGTH - [...this.draft()].length);
  readonly canSend = computed(
    () =>
      this.blocked() === null &&
      this.draft().trim().length > 0 &&
      this.left() >= 0,
  );

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  /** Follows new lines unless the reader scrolled up to read older ones. */
  private stick = true;

  constructor() {
    afterRenderEffect(() => {
      this.messages();
      const element = this.list()?.nativeElement;
      if (element && this.stick) element.scrollTop = element.scrollHeight;
    });
  }

  onScroll(element: HTMLElement): void {
    this.stick =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICK_PX;
  }

  onInput(value: string): void {
    this.draft.set(value);
  }

  /**
   * Escape hands the keys back to the game: the box loses focus and the
   * arena reads the keys again. The page's own Escape (leaving full screen)
   * is not meant — the key stops here.
   */
  leave(event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement | null)?.blur();
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.canSend()) return;
    this.send.emit(this.draft().trim());
    this.draft.set('');
    this.stick = true;
  }

  eventKey(message: ChatMessage): string {
    return `ONLINE.CHAT.EVENT.${message.event?.type}`;
  }

  /** The event itself carries the names and numbers its line needs. */
  eventParams(message: ChatMessage): object {
    return message.event ?? {};
  }
}
