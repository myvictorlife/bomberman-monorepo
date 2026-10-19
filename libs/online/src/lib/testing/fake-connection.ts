import { ArenaConnection } from '@libs/game-client';

/** A connection with no socket: tests push server messages and read what was sent. */
export class FakeConnection implements ArenaConnection {
  readonly sent: { type: string; payload: unknown }[] = [];
  readonly listeners = new Map<string, ((payload: unknown) => void)[]>();
  closeListener: ((code: number) => void) | null = null;
  left = false;

  send(type: string, payload?: unknown): void {
    this.sent.push({ type, payload });
  }

  on<T>(type: string, listener: (payload: T) => void): () => void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener as (payload: unknown) => void);
    this.listeners.set(type, list);
    return () => undefined;
  }

  onClose(listener: (code: number) => void): void {
    this.closeListener = listener;
  }

  async leave(): Promise<void> {
    this.left = true;
  }

  /** The server says something. */
  push(type: string, payload: unknown): void {
    this.listeners.get(type)?.forEach((l) => l(payload));
  }

  close(code = 1006): void {
    this.closeListener?.(code);
  }
}
