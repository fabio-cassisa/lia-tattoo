# liagiorgi.one.ttt

Portfolio-style booking platform and studio backend for **liagiorgi.one.ttt**.

This repo does two jobs at once:

- it works as a polished public-facing project and case-study piece
- it runs as a real service platform Lia can use for bookings, content updates, portfolio management, Instagram insights, and finance tracking

Current public positioning:

- `Malmö · Copenhagen based`
- working from `Studio Diamant` in Malmö
- selected dates at `Good Morning Tattoo` in Copenhagen

**Live:** [lia-tattoo.vercel.app](https://lia-tattoo.vercel.app)

## What It Covers

- localized public pages for home, portfolio, booking, about, and aftercare
- booking intake with reference image uploads and Malmö live slot selection
- Copenhagen request flow based on planned dates instead of live slot picking
- admin workspace for bookings, portfolio, site content, creative coach, finance, and settings
- CMS-like editing for homepage hero copy, About copy, About portrait, and homepage feature picks
- automated booking emails for confirmation, approvals, declines, deposit instructions, and aftercare
- Google Calendar sync for confirmed Malmö sessions
- Instagram-based creative coach for admin insights
- finance tooling for studio splits, fees, invoicing, and tax-context reporting

## System Map

```text
Public pages
  -> Next.js app routes and API routes
  -> Supabase Postgres, Storage, and Auth
  -> Gmail SMTP for transactional email
  -> Google Calendar API for Malmö booking sync
  -> Instagram Graph API cache and insights for admin workflows
```

## Docs

- [`docs/operations.md`](docs/operations.md) — deploys, migrations, smoke tests, and failure modes
- [`docs/content-model.md`](docs/content-model.md) — what lives in locale files vs CMS vs database
- [`docs/admin-guide.md`](docs/admin-guide.md) — what each admin area does and which actions have side effects

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Database | [Supabase](https://supabase.com) (Postgres, Auth, Storage) |
| Calendar | [Google Calendar API](https://developers.google.com/calendar) |
| Email | [Nodemailer](https://nodemailer.com) + Gmail SMTP |
| i18n | [next-intl 4](https://next-intl-docs.vercel.app) |
| Hosting | [Vercel](https://vercel.com) |
| Language | TypeScript 5.9 |

## Getting Started

### Prerequisites

- Node.js 20+
- a Supabase project
- a Google Cloud project with Calendar API enabled and a service account
- a Gmail account with an App Password

### Setup

```bash
git clone https://github.com/fabio-cassisa/lia-tattoo.git
cd lia-tattoo

npm install

cp .env.local.example .env.local
# Fill in the values in .env.local

npx supabase db push

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Contributor Note

This repo uses Next.js 16 and follows some non-obvious patterns. Before making framework-level changes, read:

- [`AGENTS.md`](AGENTS.md)
- the relevant docs in `node_modules/next/dist/docs/`

### Environment Variables

See [`.env.local.example`](.env.local.example) for the full list. Main variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key, server-only |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP credentials for transactional mail |
| `LIA_EMAIL` | booking notification recipient |
| `PAYPAL_ME_URL` | deposit payment link |
| `GOOGLE_CALENDAR_ID` | target Google Calendar |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | base64-encoded service account JSON |
| `META_APP_SECRET` | Meta app secret for Instagram token exchange |
| `NEXT_PUBLIC_SITE_URL` | canonical site URL used in links and metadata |

## Project Structure

```text
src/
  app/
    [locale]/            public pages
    admin/               admin workspace, English-only and noindex
    api/                 bookings, admin, calendar, portfolio, instagram
  components/            public and admin UI
  i18n/                  locale routing and request config
  lib/                   Supabase, email, calendar, finance, instagram, site content
messages/                locale messages and metadata copy
supabase/migrations/     SQL migrations
docs/                    operator and project documentation
```

## Booking Flow

1. Client picks Malmö or Copenhagen.
2. Client fills the intake form and can upload reference images.
3. Malmö bookings use live availability. Copenhagen bookings suggest preferred dates.
4. Booking is stored in Supabase.
5. Client gets a confirmation email and Lia gets a notification.
6. Admin approves, declines, or updates the request.
7. Marking a Malmö booking as `deposit_paid` can create a Google Calendar event.
8. Marking a booking as `completed` sends aftercare.

## Deployment

Standard production flow:

```bash
npm run lint
npm run build
npx supabase migration list
npx supabase db push
vercel --yes --prod
```

Use [`docs/operations.md`](docs/operations.md) for the full deploy and smoke-test checklist.

## License

Private project. Not open source.
