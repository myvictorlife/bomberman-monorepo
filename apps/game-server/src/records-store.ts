import { PlayerRecord } from '@libs/game-lobby';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

/**
 * Player records in one JSON file. Enough for a single server process and a
 * few thousand accounts; swap it for a database behind the same methods when
 * that stops being true.
 *
 * Writes are batched and atomic (temp file, then rename), so a crash mid-write
 * never leaves a half-written file.
 */
export class RecordsStore {
  private readonly records = new Map<string, PlayerRecord>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly file: string,
    private readonly delayMs = 1_000,
  ) {}

  load(): void {
    if (!existsSync(this.file)) return;
    const parsed: unknown = JSON.parse(readFileSync(this.file, 'utf8'));
    if (!Array.isArray(parsed)) return;
    for (const record of parsed as PlayerRecord[]) {
      if (record && typeof record.id === 'string')
        this.records.set(record.id, record);
    }
  }

  get(id: string): PlayerRecord | undefined {
    return this.records.get(id);
  }

  all(): ReadonlyMap<string, PlayerRecord> {
    return this.records;
  }

  put(...records: PlayerRecord[]): void {
    for (const record of records) this.records.set(record.id, record);
    this.timer ??= setTimeout(() => this.flush(), this.delayMs);
  }

  /** Writes now. Called on shutdown so the last round is never lost. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify([...this.records.values()], null, 2));
    renameSync(temp, this.file);
  }
}
