import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content collections for Smashing '72.
 *
 * These schemas are the single source of truth for editable content and they
 * map 1:1 to the collections defined in /public/admin/config.yml (Decap CMS).
 * Images are stored in /public/uploads and referenced as string paths
 * (e.g. "/uploads/photo.jpg"), which is how Decap saves uploaded media.
 */

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string().optional(),
    cover: z.string().optional(), // "/uploads/…"
    draft: z.boolean().default(false),
  }),
});

const teams = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/teams' }),
  schema: z.object({
    title: z.string(), // team name
    category: z.enum(['Heren', 'Dames', 'Jeugd', 'Recreanten']).default('Heren'),
    order: z.number().default(99),
    level: z.string(),
    coach: z.string().optional(),
    practice: z.string().optional(),
    photo: z.string().optional(), // "/uploads/…" or full URL
    instagram: z.string().optional(), // Instagram profile URL
    // Nevobo per-team RSS feeds (set in the CMS). Example:
    // https://api.nevobo.nl/export/team/CKL7J75/heren/1/programma.rss
    scheduleUrl: z.string().optional(),
    resultsUrl: z.string().optional(), // reserved for later (results feed)
    players: z
      .array(
        z.object({
          name: z.string(),
          role: z.string().optional(),
          number: z.number().optional(),
        })
      )
      .default([]),
  }),
});

// NOTE: match fixtures are NOT a content collection — they come from the
// Nevobo RSS feed at build time (see src/lib/matches.ts).

// Temporary home-page announcements (e.g. an upcoming party). The `date` is
// the event date: announcements are hidden once it has passed. The markdown
// body is the description. `image` is a poster shown with a click-to-enlarge
// lightbox.
const announcements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/announcements' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(), // "/uploads/…"
  }),
});

// Sponsors shown in the home-page news sidebar (logo + link).
const sponsors = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sponsors' }),
  schema: z.object({
    name: z.string(),
    url: z.string().optional(),
    logo: z.string().optional(), // "/uploads/…"
    order: z.number().default(99),
  }),
});

// One entry per static page (About, Teams, News, Join, Contact): the hero
// (frontmatter) plus the body text (markdown). Forms stay in the templates.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    eyebrow: z.string().optional(),
    title: z.string(),
    text: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

export const collections = { news, teams, announcements, sponsors, pages };
