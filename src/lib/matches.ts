import { XMLParser } from 'fast-xml-parser';

/**
 * Nevobo match schedule.
 *
 * The club's fixtures are published by the national volleyball body (Nevobo)
 * as an RSS feed — we don't administer them. This runs at BUILD TIME (the feed
 * has no CORS header, so a browser can't read it directly), so keep the site
 * fresh with a scheduled rebuild (see README / .github/workflows).
 *
 * We surface the next day on which the club plays at HOME (our club is the home
 * team, i.e. the left side of the title), with every home match that day
 * grouped by time slot. We play at a single venue, so the address is omitted.
 */

const FEED_URL = 'https://api.nevobo.nl/export/vereniging/CKL7J75/programma.rss';
const CLUB = 'smashing'; // matched case-insensitively against the home team
const TZ = 'Europe/Amsterdam'; // group/format in the club's local timezone

export interface HomeMatch {
  id: string;
  date: Date;
  homeTeam: string;
  awayTeam: string;
  link: string;
  provisional: boolean;
}

export interface TimeSlot {
  time: string; // "HH:MM" local
  matches: HomeMatch[];
}

export interface HomeMatchDay {
  date: Date; // representative instant; all matches share this local date
  slots: TimeSlot[];
}

// Local (Amsterdam) date key "YYYY-MM-DD" and time "HH:MM", so grouping is
// correct regardless of the build server's timezone.
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

/** Fetch + parse the feed into all upcoming home matches, soonest first. */
async function fetchHomeMatches(): Promise<HomeMatch[]> {
  let xml: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(FEED_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.warn(`[matches] Could not fetch Nevobo feed: ${(err as Error).message}`);
    return [];
  }

  let items: Record<string, unknown>[];
  try {
    const parser = new XMLParser({ ignoreAttributes: true });
    const data = parser.parse(xml) as any;
    const raw = data?.rss?.channel?.item ?? [];
    items = Array.isArray(raw) ? raw : [raw];
  } catch (err) {
    console.warn(`[matches] Could not parse Nevobo feed: ${(err as Error).message}`);
    return [];
  }

  const now = Date.now();
  const matches: HomeMatch[] = [];

  for (const item of items) {
    // Nevobo marks the whole pre-season programme as "concept" (provisional)
    // and only finalizes closer to match day — those are still real fixtures,
    // so we keep them and flag them. We only drop entries with no date at all.
    const status = String(item['nevobo:status'] ?? '').toLowerCase();
    const provisional = status === 'concept';

    const pub = String(item.pubDate ?? '').trim();
    if (!pub) continue;
    const date = new Date(pub);
    if (Number.isNaN(date.valueOf())) continue;
    if (date.valueOf() < now) continue; // upcoming only

    // Title: "5 sep 13:00: Smashing '72 DS 1 - VCH DS 1"
    // Everything after the first ": " is the matchup (the time's colon has no
    // following space, so it is not a false split point).
    const title = String(item.title ?? '');
    const sep = title.indexOf(': ');
    const matchup = sep >= 0 ? title.slice(sep + 2) : title;
    const parts = matchup.split(' - ');
    if (parts.length < 2) continue;

    const homeTeam = parts[0].trim();
    const awayTeam = parts.slice(1).join(' - ').trim();

    // Home matches only: our club hosts.
    if (!homeTeam.toLowerCase().includes(CLUB)) continue;

    matches.push({
      id: String(item.guid ?? item.link ?? title),
      date,
      homeTeam,
      awayTeam,
      link: String(item.link ?? ''),
      provisional,
    });
  }

  matches.sort((a, b) => a.date.valueOf() - b.date.valueOf());
  return matches;
}

/**
 * The next home-match day: the soonest upcoming date the club plays at home,
 * with every home match that day grouped by time slot (earliest first).
 * Returns null when there are no upcoming home matches (or the feed failed).
 */
export async function getNextHomeMatchDay(): Promise<HomeMatchDay | null> {
  const all = await fetchHomeMatches();
  if (all.length === 0) return null;

  // All matches on the same local date as the soonest one.
  const firstKey = dateKeyFmt.format(all[0].date);
  const sameDay = all.filter((m) => dateKeyFmt.format(m.date) === firstKey);

  // Group by local time slot.
  const byTime = new Map<string, HomeMatch[]>();
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
