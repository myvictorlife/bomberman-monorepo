import { parseRules, PUBLIC_ROOM_RULES, RoomRules } from '@libs/game-protocol';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

/**
 * The room's rules as an admin last set them, in one JSON file next to the
 * player records. Loaded at boot — so a restart keeps what was configured —
 * and written whenever they change. A file that does not pass
 * {@link parseRules} (an old key, a value no longer offered) is ignored.
 */
export class RulesStore {
  constructor(private readonly file: string) {}

  load(): RoomRules | null {
    if (!existsSync(this.file)) return null;
    try {
      return parseRules(
        JSON.parse(readFileSync(this.file, 'utf8')),
        PUBLIC_ROOM_RULES,
      );
    } catch {
      return null;
    }
  }

  save(rules: RoomRules): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(rules, null, 2));
    renameSync(temp, this.file);
  }
}
