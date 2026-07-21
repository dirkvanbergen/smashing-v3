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
    order: z.number().default(99),
    level: z.string(),
    coach: z.string().optional(),
    practice: z.string().optional(),
    photo: z.string().optional(), // "/uploads/…"
  }),
});

const matches = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/matches' }),
  schema: z.object({
    date: z.coerce.date(),
    home: z.string(),
    away: z.string(),
    location: z.string().optional(),
    isHome: z.boolean().default(true),
  }),
});

export const collections = { news, teams, matches };
