import { XMLParser } from 'fast-xml-parser';

/**
 * Nevobo match feeds (RSS).
 *
 * Fixtures are published by the national volleyball body (Nevobo) — we don't
 * administer them. These run at BUILD TIME (the feeds have no CORS header, so a
 * browser can't read them directly); keep the site fresh with a scheduled
 * rebuild (see README / .github/workflows).
 *
 *  - The club "programma" feed powers the home-page "next home match day".
 *  - Per-team "programma" feeds (URL set per team in the CMS) power each team
 *    page's upcoming schedule.
 */

const CLUB_FEED_URL = 'https://api.nevobo.nl/export/vereniging/CKL7J75/programma.rss';
const CLUB = 'smashing'; // matched case-insensitively against team names
const TZ = 'Europe/Amsterdam';

export interface Match {
  id: string;
  date: Date;
  home: string;
  away: string;
  venue: string;
  link: string;
  provisional: boolean;
}

export interface TimeSlot {
  time: string; // "HH:MM" local
  matches: Match[];
}

export interface HomeMatchDay {
  date: Date;
  slots: TimeSlot[];
}

export interface TeamMatch extends Match {
  isHome: boolean;
  opponent: string;
}

const dateKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function parseVenue(description: string): string {
  const m = description.match(/Speellocatie:\s*(.+?)\s*$/);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

/** Parse a Nevobo "programma" RSS document into matches (no filtering). */
function parseFeed(xml: string): Match[] {
  let items: Record<string, unknown>[];
  try {
    const parser = new XMLParser({ ignoreAttributes: true });
    const data = parser.parse(xml) as any;
    const raw = data?.rss?.channel?.item ?? [];
    items = Array.isArray(raw) ? raw : [raw];
  } catch (err) {
    console.warn(`[matches] Could not parse feed: ${(err as Error).message}`);
    return [];
  }

  const matches: Match[] = [];
  for (const item of items) {
    // Nevobo marks the pre-season programme "concept" (provisional); those are
    // still real fixtures. We only drop entries with no date at all.
    const status = String(item['nevobo:status'] ?? '').toLowerCase();
    const provisional = status === 'concept';

    const pub = String(item.pubDate ?? '').trim();
    if (!pub) continue;
    const date = new Date(pub);
    if (Number.isNaN(date.valueOf())) continue;

    // Title: "5 sep 13:00: Smashing '72 DS 1 - VCH DS 1"
    // Everything after the first ": " is the matchup (the time's colon has no
    // following space, so it is not a false split point).
    const title = String(item.title ?? '');
    const sep = title.indexOf(': ');
    const matchup = sep >= 0 ? title.slice(sep + 2) : title;
    const parts = matchup.split(' - ');
    if (parts.length < 2) continue;

    matches.push({
      id: String(item.guid ?? item.link ?? title),
      date,
      home: parts[0].trim(),
      away: parts.slice(1).join(' - ').trim(),
      venue: parseVenue(String(item.description ?? '')),
      link: String(item.link ?? ''),
      provisional,
    });
  }
  return matches;
}

/** Fetch + parse a feed. Never throws: returns [] on any network/parse error. */
async function fetchFeed(url: string): Promise<Match[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text());
  } catch (err) {
    console.warn(`[matches] Could not fetch feed ${url}: ${(err as Error).message}`);
    return [];
  }
}

/**
 * The next home-match day for the club: the soonest upcoming date we play at
 * home, with every home match that day grouped by local time slot.
 */
export async function getNextHomeMatchDay(): Promise<HomeMatchDay | null> {
  const now = Date.now();
  const all = (await fetchFeed(CLUB_FEED_URL))
    .filter((m) => m.date.valueOf() >= now && m.home.toLowerCase().includes(CLUB))
    .sort((a, b) => a.date.valueOf() - b.date.valueOf());
  if (all.length === 0) return null;

  const firstKey = dateKeyFmt.format(all[0].date);
  const sameDay = all.filter((m) => dateKeyFmt.format(m.date) === firstKey);

  const byTime = new Map<string, Match[]>();
  for (const m of sameDay) {
    const t = timeFmt.format(m.date);
    let arr = byTime.get(t);
    if (!arr) {
      arr = [];
      byTime.set(t, arr);
    }
    arr.push(m);
  }

  const slots: TimeSlot[] = [...byTime.entries()]
    .map(([time, matches]) => ({ time, matches }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return { date: all[0].date, slots };
}

/**
 * Upcoming matches for a single team, from its Nevobo "programma" feed URL
 * (set per team in the CMS). Includes home and away games; `opponent` and
 * `isHome` are relative to our club. Returns [] if no URL or the feed failed.
 */
export async function getTeamUpcoming(url: string | undefined, limit = 6): Promise<TeamMatch[]> {
  if (!url) return [];
  const now = Date.now();
  return (await fetchFeed(url))
    .filter((m) => m.date.valueOf() >= now)
    .sort((a, b) => a.date.valueOf() - b.date.valueOf())
    .slice(0, limit)
    .map((m) => {
      const isHome = m.home.toLowerCase().includes(CLUB);
      return { ...m, isHome, opponent: isHome ? m.away : m.home };
    });
}
