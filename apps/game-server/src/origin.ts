/**
 * The origin a configured value names (`https://example.com`), or `null` when
 * it is not a web origin. A trailing slash or path is dropped, case folded.
 */
export function normalizeOrigin(value: string): string | null {
  try {
    const { origin } = new URL(value.trim());
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether a request sent from `origin` may use the server. An empty list lets
 * everyone in — the default, so a fork works before it has a domain. Otherwise
 * the origin must be listed, or be this machine (`localhost`, `127.0.0.1`,
 * `[::1]`, any port) so local development keeps working: no other site can
 * make a visitor's browser send a loopback origin. A request without one — a
 * script, not a page — is refused.
 *
 * A soft guard: a script can forge the header. It stops other sites from
 * embedding the room, and the copied-and-pasted bot.
 */
export function originAllowed(
  origin: string | null | undefined,
  allowed: readonly string[],
): boolean {
  if (!allowed.length) return true;
  const normalized = origin ? normalizeOrigin(origin) : null;
  if (!normalized) return false;
  return (
    allowed.includes(normalized) || LOOPBACK.has(new URL(normalized).hostname)
  );
}

/**
 * The CORS headers for a request from `origin`: `*` when every origin is
 * allowed, the origin itself when it is listed, `null` when it is refused.
 */
export function corsOrigin(
  origin: string | null | undefined,
  allowed: readonly string[],
): Record<string, string> | null {
  if (!allowed.length) return { 'Access-Control-Allow-Origin': '*' };
  if (!origin || !originAllowed(origin, allowed)) return null;
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}
