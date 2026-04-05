# Operations

This is the service-side runbook for `lia-tattoo`.

## Standard Commands

| Task | Command |
|------|---------|
| Start local dev | `npm run dev` |
| Run lint | `npm run lint` |
| Run production build locally | `npm run build` |
| Check local vs remote migrations | `npx supabase migration list` |
| Push pending migrations | `npx supabase db push` |
| Deploy production | `vercel --yes --prod` |

If you already have the Supabase CLI installed globally, `supabase ...` is fine too.

## Production Deploy Workflow

1. Make sure `main` is clean and up to date.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Run `npx supabase migration list`.
5. If the remote is behind, run `npx supabase db push`.
6. Deploy with `vercel --yes --prod`.
7. Confirm the production alias resolves to `https://lia-tattoo.vercel.app`.
8. Run the smoke checklist below.

## Smoke Checklist

Check these pages after deploy:

- `/en`
- `/en/about`
- `/en/booking`
- `/admin/login`
- `/opengraph-image`

What to verify:

- homepage metadata title matches the current positioning
- homepage hero and footer branding match the latest copy
- homepage preview images load
- About shows the correct studio names and location labels
- booking page shows the correct Malmö and Copenhagen wording
- no stale public copy survives from older positioning
- admin login page loads
- the generated OG image renders

## What Requires A Deploy

| Change | Where it lives | Deploy needed | DB migration needed | Notes |
|--------|----------------|---------------|---------------------|-------|
| Site content text edited in admin | `site_content` table | No | No | Save in `/admin/content` triggers revalidation |
| About portrait URL or upload | `site_content` + Supabase storage | No | No | Upload is not live until `Save changes` is clicked |
| Homepage feature picks | `portfolio_images.featured_on_homepage` | No | No | Managed in `/admin/content` |
| Portfolio uploads and visibility | `portfolio_images` + storage | No | No | Managed in `/admin/portfolio` |
| Locale metadata, nav copy, form labels | `messages/*.json` | Yes | No | Needs a code deploy |
| New editable site-content key | code + `site_content` schema/defaults | Yes | Usually yes | Add definition, types, admin support, and migration |
| New DB schema | `supabase/migrations/*.sql` | Yes | Yes | Push migration before or during deploy flow |
| Environment variable changes | Vercel and/or local env | Usually yes | No | Redeploy after changing production envs |

## Booking Side Effects

Public booking creation:

- inserts the booking into Supabase
- tries to send a client confirmation email
- tries to send a new-booking notification email
- uploads reference images in a separate request after the booking is created

Admin status changes:

| Status / action | Side effect |
|-----------------|-------------|
| `approved` | sends approval email |
| `declined` | sends decline email |
| `deposit_paid` | creates a Google Calendar event for Malmö bookings when an appointment date exists |
| `completed` | sends aftercare email |
| `cancelled` | deletes an existing Google Calendar event |
| delete booking | deletes the booking, tries to remove any calendar event, and tries to remove stored reference images |

Important behavior:

- calendar sync only applies to Malmö bookings
- email failures are logged but do not roll back the booking update
- calendar failures are returned as `calendar_error` but do not block the booking update
- editing a synced Malmö booking can update the existing calendar event

## Common Failure Modes

### Admin returns `401 Unauthorized`

- sign in again at `/admin/login`
- check Supabase auth env vars and session cookies

### Booking updated but calendar did not sync

- confirm the booking is for Malmö
- confirm `appointment_date` exists
- confirm the status is `deposit_paid` or `completed`
- check Google Calendar env vars and service account access

### Booking updated but no email was sent

- confirm Gmail env vars are present
- check app password validity
- inspect server logs; email failures are non-blocking by design

### Content changed in admin but public page still looks old

- confirm `Save changes` was clicked
- revisit the public page after revalidation
- if the change was in `messages/*.json`, it requires a deploy and is not an admin-editable CMS change

### Local and remote migrations drift

- run `npx supabase migration list`
- push pending migrations with `npx supabase db push`

## Release Notes Habit

For meaningful checkpoints, record:

- commit SHA
- whether migrations were pushed
- production deploy URL or alias
- anything changed in public positioning or admin workflows
