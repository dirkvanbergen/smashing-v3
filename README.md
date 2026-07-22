# Smashing '72 — club website

Static website for the Smashing '72 volleyball club, built with
[Astro](https://astro.build/) and edited through
[Decap CMS](https://decapcms.org/). Content editors log in at `/admin` and never
have to touch code or GitHub.

- **Framework:** Astro 5 (static output), TypeScript
- **CMS:** Decap CMS + Netlify Identity + Git Gateway
- **Forms:** Netlify Forms (contact + join), no backend needed
- **Hosting:** Netlify

---

## Running locally

You need [Node.js](https://nodejs.org/) 18.20+, 20.3+, or 22+.

```sh
npm install      # install dependencies
npm run dev      # start dev server at http://localhost:4321
npm run build    # build the production site to ./dist
npm run preview  # preview the production build locally
```

> **Windows note:** if `node` / `npm` aren't found, Node is installed at
> `C:\Program Files\nodejs`. Add that folder to your PATH (System → Environment
> Variables) so the commands work in any terminal.

### Project structure

```
src/
├── components/     Nav, Footer
├── content/        Editable content (markdown) — mirrors the CMS
│   ├── news/       News posts
│   ├── teams/      Teams
│   └── matches/    Match schedule
├── content.config.ts   Collection schemas (source of truth)
├── layouts/        BaseLayout (head, nav, footer)
├── pages/          Home, News (+ per-post), Teams, About, Join, Contact, Thanks
└── styles/         global.css (club-red theme)
public/
├── admin/          Decap CMS (index.html + config.yml)
├── uploads/        CMS-uploaded images land here
└── favicon.svg
```

The schemas in [`src/content.config.ts`](src/content.config.ts) and the
collections in [`public/admin/config.yml`](public/admin/config.yml) are kept in
sync — the fields an editor sees in the CMS map directly to the frontmatter the
Astro pages read.

---

## For content editors: using `/admin`

1. Go to `https://<your-site>.netlify.app/admin/`.
2. Log in with the email invite the club admin sent you (set a password on first
   use).
3. Pick what you want to edit and click **New** (or an existing entry):
   - **Site settings → Home page** — the hero photo, headings and intro text.
   - **Announcements** — temporary home-page notices (e.g. a party).
   - **News**, **Teams**, **Sponsors** — the main content.

   > The **match schedule is not in the CMS** — fixtures come automatically from
   > the Nevobo feed (see below).

   Each **team** has its own page (`/teams/<name>`) with a description, photo,
   players list, Instagram link, and an auto-updating **upcoming schedule**. To
   wire the schedule, paste the team's Nevobo *programma* feed URL into the
   **Nevobo schedule feed URL** field, e.g.
   `https://api.nevobo.nl/export/team/CKL7J75/heren/1/programma.rss`
   (`heren`/`dames`/`meisjes`/`jongens` + team number). Results and division
   standings are not shown yet.
4. Fill in the fields, upload images where offered, and click **Publish**.
5. Your change is committed to the site's Git repo and the site rebuilds
   automatically — it's live in a minute or two.

**News posts** have a **Draft** toggle: leave it on to keep a post hidden until
it's ready.

**Announcements** show directly under the hero on the home page and disappear
automatically once their **date** has passed. When more than one is active they
alternate colours and swap which side the poster is on; click a poster to view
it full-size. Because this is a static site, an expired announcement is removed
in the browser immediately, and fully drops out of the HTML on the next rebuild
(any CMS publish triggers one). If you want them to clear without anyone
publishing, add a daily
[scheduled build](https://docs.netlify.com/configure-builds/build-hooks/) in
Netlify.

### Optional: editing content locally

Developers can run the CMS against local files without Netlify:

1. Uncomment `local_backend: true` in `public/admin/config.yml`.
2. In one terminal: `npx decap-server`
3. In another: `npm run dev`
4. Open `http://localhost:4321/admin/`.

Re-comment `local_backend: true` before deploying.

---

## Deploying to Netlify

Push this repo to GitHub (or GitLab/Bitbucket) and create a new site from it in
Netlify. The build settings come from [`netlify.toml`](netlify.toml):

- **Build command:** `npm run build`
- **Publish directory:** `dist`

### ⚠️ Manual steps in the Netlify dashboard (can't be done from code)

After the first deploy, enable these in the Netlify UI:

1. **Identity** — *Site configuration → Identity → Enable Identity.*
   - Under **Registration**, set it to **Invite only** (recommended for a club).
   - Under **Services → Git Gateway**, click **Enable Git Gateway**. This is what
     lets editors commit content without a GitHub account.
2. **Invite editors** — *Identity → Invite users.* Each editor gets an email to
   set a password, then logs in at `/admin`.
3. **Forms** — *Forms* should list `contact` and `join` after the first deploy
   that includes them. If not, trigger a redeploy. Then set up
   **Forms → Form notifications** to email submissions to the club inbox.
   (Netlify auto-detects the static forms; no extra config needed.)

### Match schedule (Nevobo feed)

Home-page fixtures are **not** edited by anyone — they're pulled from the club's
official Nevobo RSS feed
(`https://api.nevobo.nl/export/vereniging/CKL7J75/programma.rss`) by
[`src/lib/matches.ts`](src/lib/matches.ts) at **build time**, filtered to the
next few upcoming **home** matches.

Because the feed can't be read directly from the browser (no CORS header), it's
fetched during the build and baked into the static page. Provisional
("concept") fixtures are shown with a *Provisional* tag, since Nevobo marks the
whole pre-season programme that way until it's finalized. If the feed is
unreachable at build time, the section simply shows "no home matches" and the
build still succeeds.

**Keeping it fresh — scheduled rebuild (one-time setup):**
Since the schedule is baked in at build time, rebuild the site periodically so
it stays current. A ready-made GitHub Actions workflow does this daily:
[`.github/workflows/refresh-schedule.yml`](.github/workflows/refresh-schedule.yml).
To enable it:

1. In Netlify: **Site configuration → Build & deploy → Build hooks → Add build
   hook**. Copy the generated URL.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, name it `NETLIFY_BUILD_HOOK`, and paste the URL.

The workflow then triggers a rebuild every morning (and you can run it manually
from the Actions tab). Adjust the `cron:` line to change the frequency.

### Notes / to-do

- Update `site` in [`astro.config.mjs`](astro.config.mjs) to your real Netlify
  URL (used for canonical URLs / SEO).
- Replace placeholder contact details (address, `info@smashing72.example`) in
  `Footer.astro`, `contact.astro` and `join.astro`.
- Swap in real photos: upload via the CMS, or drop files in `public/uploads/`.
- The sample News / Teams / Matches entries in `src/content/` are placeholders —
  edit or delete them once real content is in.
- Consider enabling Netlify's spam filtering / reCAPTCHA on the forms if you get
  spam (the honeypot field handles most of it).
