import {
  CampaignProgress,
  CharacterId,
  PlayerColorId,
  sanitizeProgress,
} from '@libs/game-core';
import {
  PlayerProfile,
  ProfileUpdate,
  RankingEntry,
} from '@libs/game-protocol';

/** What the server keeps per account: enough for a ranking and to tell a returning player. */
export interface PlayerRecord {
  id: string;
  name: string;
  wins: number;
  matches: number;
  visits: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Who they played as in their last round — the face on the podium when they have no favourite. */
  characterId?: CharacterId;
  /** They picked `name` themselves: signing in no longer replaces it with the account's name. */
  nameChosen?: boolean;
  /** The character they play as, on any device. */
  favoriteCharacterId?: CharacterId;
  /** The colour they asked for; a round may give them the closest free one. */
  color?: PlayerColorId;
  /** How far they are in the campaign, played in the stages room. */
  campaign?: CampaignProgress;
}

/**
 * Only the fields a {@link PlayerRecord} has. A record built by spreading
 * something wider — a verified account carries the e-mail — would write all of
 * it to disk; this also drops what older records picked up that way.
 */
export function cleanRecord(record: PlayerRecord): PlayerRecord {
  const {
    id,
    name,
    wins,
    matches,
    visits,
    firstSeenAt,
    lastSeenAt,
    characterId,
    nameChosen,
    favoriteCharacterId,
    color,
    campaign,
  } = record;
  return {
    id,
    name,
    wins,
    matches,
    visits,
    firstSeenAt,
    lastSeenAt,
    ...(characterId ? { characterId } : {}),
    ...(nameChosen ? { nameChosen } : {}),
    ...(favoriteCharacterId ? { favoriteCharacterId } : {}),
    ...(color ? { color } : {}),
    ...(campaign ? { campaign: sanitizeProgress(campaign) } : {}),
  };
}

/** A stage played in the stages room moved the player's campaign on. */
export function recordStage(
  record: PlayerRecord,
  campaign: CampaignProgress,
  now: number,
): PlayerRecord {
  return cleanRecord({ ...record, campaign, lastSeenAt: now });
}

/** Coming back after this long away counts as a new visit. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/** Signs someone in: creates the record on the first visit, counts a visit after a gap. */
export function recordVisit(
  existing: PlayerRecord | undefined,
  account: { id: string; name: string },
  now: number,
): PlayerRecord {
  if (!existing) {
    return {
      id: account.id,
      name: account.name,
      wins: 0,
      matches: 0,
      visits: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    };
  }
  const newVisit = now - existing.lastSeenAt >= VISIT_GAP_MS;
  return cleanRecord({
    ...existing,
    name: existing.nameChosen ? existing.name : account.name || existing.name,
    visits: existing.visits + (newVisit ? 1 : 0),
    lastSeenAt: now,
  });
}

/** Names compare without case, accents or spacing: "Ána" and "ana" are the same player. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Applies what a player changed about themselves. A name another record
 * already has — compared by {@link nameKey} — is refused, so nobody on the
 * ranking can pass for someone else. Keeping one's own name is never a clash.
 */
export function updateProfile(
  record: PlayerRecord,
  update: ProfileUpdate,
  all: Iterable<PlayerRecord>,
): PlayerRecord | 'name-taken' {
  const next: PlayerRecord = { ...record };
  if (update.name !== undefined) {
    const key = nameKey(update.name);
    for (const other of all) {
      if (other.id !== record.id && nameKey(other.name) === key)
        return 'name-taken';
    }
    next.name = update.name;
    next.nameChosen = true;
  }
  if (update.favoriteCharacterId !== undefined)
    next.favoriteCharacterId = update.favoriteCharacterId;
  if (update.color === null) delete next.color;
  else if (update.color !== undefined) next.color = update.color;
  return cleanRecord(next);
}

/** A round ended: everyone in it played one more match, and the winner (if any) won it. */
export function recordRound(
  records: ReadonlyMap<string, PlayerRecord>,
  playerIds: readonly string[],
  winnerId: string | null,
  now: number,
  /** Who each player was, by id; a player not listed keeps their last face. */
  characters: ReadonlyMap<string, CharacterId> = new Map(),
): PlayerRecord[] {
  return playerIds.flatMap((id) => {
    const record = records.get(id);
    if (!record) return [];
    return [
      {
        ...record,
        characterId: characters.get(id) ?? record.characterId,
        matches: record.matches + 1,
        wins: record.wins + (id === winnerId ? 1 : 0),
        lastSeenAt: now,
      },
    ];
  });
}

/** Most wins first; on a tie, fewer matches (a better rate), then by name. Only players with a win. */
export function ranking(
  records: Iterable<PlayerRecord>,
  limit = 10,
): RankingEntry[] {
  return [...records]
    .filter((r) => r.wins > 0)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        a.matches - b.matches ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((r) => {
      const face = r.favoriteCharacterId ?? r.characterId;
      return {
        id: r.id,
        name: r.name,
        wins: r.wins,
        matches: r.matches,
        ...(face ? { characterId: face } : {}),
        ...(r.color ? { color: r.color } : {}),
      };
    });
}

export function toProfile(
  record: PlayerRecord,
  all: Iterable<PlayerRecord>,
): PlayerProfile {
  const place = ranking(all, Number.MAX_SAFE_INTEGER).findIndex(
    (r) => r.id === record.id,
  );
  const face = record.favoriteCharacterId ?? record.characterId;
  return {
    id: record.id,
    name: record.name,
    nameChosen: record.nameChosen === true,
    wins: record.wins,
    matches: record.matches,
    ...(face ? { characterId: face } : {}),
    ...(record.favoriteCharacterId
      ? { favoriteCharacterId: record.favoriteCharacterId }
      : {}),
    ...(record.color ? { color: record.color } : {}),
    visits: record.visits,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    returning: record.visits > 1,
    rank: place === -1 ? null : place + 1,
    ...(record.campaign ? { campaign: record.campaign } : {}),
  };
}
