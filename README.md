# liagiorgi.one.ttt

Booking platform and portfolio site for **liagiorgi.one.ttt** — a Traditional tattoo artist based in Malmö and Copenhagen.

Built as a mobile-first link-in-bio destination from [@liagiorgi.one.ttt](https://instagram.com/liagiorgi.one.ttt) on Instagram, with a smooth booking flow as the primary feature.

**Live:** [lia-tattoo.vercel.app](https://lia-tattoo.vercel.app)

---

## Features

- **Booking system** with intake form, location picker (Malmö / Copenhagen), size/type/placement selection, and reference image uploads
- **Live calendar slot picker** (Malmö) — shows real-time availability via Google Calendar FreeBusy API, no event details exposed
- **Preferred dates** (Copenhagen) — free-text date suggestions for on-demand scheduling
- **Admin dashboard** — booking management with status workflow (pending → approved → deposit paid → completed), action buttons, and calendar sync indicator
- **Automated emails** — confirmation, approval/decline, deposit instructions, aftercare reminders (Nodemailer + Gmail SMTP)
- **Google Calendar integration** — auto-creates/deletes events on Lia's calendar when bookings are confirmed/cancelled
- **4-language i18n** — English, Swedish, Italian, Danish (location-aware currency: SEK/DKK/EUR)
- **Portfolio & About pages** — flash grid, studio info, artist bio
- **Aftercare page** — step-by-step timeline with do's and don'ts

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Database | [Supabase](https://supabase.com) (Postgres, Auth, Storage) |
| Calendar | [Google Calendar API](https://developers.google.com/calendar) (service account) |
| Email | [Nodemailer](https://nodemailer.com) + Gmail SMTP |
| i18n | [next-intl 4](https://next-intl-docs.vercel.app) |
| Hosting | [Vercel](https://vercel.com) |
| Language | TypeScript 5.9 |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- A Google Cloud project with Calendar API enabled + service account
- A Gmail account with an App Password

### Setup

```bash
# Clone
git clone https://github.com/fabio-cassisa/lia-tattoo.git
cd lia-tattoo

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in all values — see comments in the file for guidance

# Run database migrations
npx supabase db push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See [`.env.local.example`](.env.local.example) for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail SMTP credentials |
| `LIA_EMAIL` | Booking notification recipient |
| `GOOGLE_CALENDAR_ID` | Target Google Calendar ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64-encoded service account JSON |
| `META_APP_SECRET` | Meta app secret for server-side Instagram token exchange |
| `NEXT_PUBLIC_SITE_URL` | Production URL (used in emails) |

## Project Structure

```
src/
├── app/
│   ├── [locale]/          # i18n pages (/, /portfolio, /booking, /about, /aftercare)
│   ├── admin/             # Admin dashboard (English-only, noindex)
│   └── api/
│       ├── bookings/      # POST booking, POST images
│       ├── admin/         # GET/PATCH bookings (auth required)
│       └── calendar/      # GET availability slots
├── components/            # SlotPicker, Header, Footer, decorative SVGs
├── i18n/                  # Routing config, request config
├── lib/
│   ├── supabase/          # Client, server, admin clients + DB types
│   ├── google-calendar/   # Availability, event CRUD, timezone handling
│   └── email/             # Transporter, templates, send functions
└── proxy.ts               # next-intl middleware (Next.js 16 style)
messages/
├── en.json                # English
├── sv.json                # Swedish
├── it.json                # Italian
└── da.json                # Danish
supabase/
└── migrations/            # SQL schema migrations
```

## Booking Flow

1. Client picks location (Malmö or Copenhagen)
2. Client fills intake form — type, description, placement, size, color preference, allergies, contact info
3. **Malmö:** Client picks a date/time slot from the live calendar. **Copenhagen:** Client suggests preferred dates
4. Booking submitted → client gets confirmation email, admin gets notification
5. Admin approves or declines in the dashboard
6. If approved → client receives deposit payment instructions
7. Client pays deposit → admin marks as paid → calendar event auto-created
8. After session → admin marks complete → automatic aftercare email

## Deployment

Deployed to Vercel via CLI:

```bash
vercel --yes --prod
```

All environment variables must be set in the Vercel project settings.

## License

Private project. Not open source.
