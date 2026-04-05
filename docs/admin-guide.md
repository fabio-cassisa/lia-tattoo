# Admin Guide

This is the operator guide for the `/admin` workspace.

## Access

- admin lives under `/admin`
- sign-in uses Supabase email/password auth via `/api/admin/auth`
- admin pages are English-only
- admin metadata is `noindex, nofollow`

If an admin page redirects or returns `401`, sign in again at `/admin/login`.

## Main Sections

### Bookings

Route: `/admin`

Purpose:

- review incoming tattoo requests
- edit request details and admin notes
- manage deposit amount and booking status
- keep Malmö calendar sync aligned with the booking state

Key statuses:

- `pending`
- `approved`
- `declined`
- `deposit_paid`
- `completed`
- `cancelled`

Important side effects:

- approving sends an approval email
- declining sends a decline email
- marking `deposit_paid` can create a Google Calendar event for Malmö bookings
- marking `completed` sends aftercare
- cancelling can remove an existing calendar event
- deleting a booking also tries to remove reference images and any calendar event

### Portfolio

Route: `/admin/portfolio`

Purpose:

- upload flash and completed-work images
- edit title and category
- change visibility and display order
- remove images permanently

Behavior:

- uploads accept JPEG, PNG, WebP, and HEIC
- HEIC is processed client-side before upload when possible
- files are stored in the Supabase `portfolio` bucket
- deleting an image removes the database record and tries to remove the storage object too

Important distinction:

- portfolio image visibility and ordering live here
- homepage feature picks do not live here; they live in `Site Content`

### Site Content

Route: `/admin/content`

Purpose:

- edit structured public copy
- manage the About portrait
- choose homepage feature picks

Editorial rules:

- English source is canonical
- Italian override is available directly in the UI
- Swedish and Danish are intentionally not exposed for manual editing right now

Behavior:

- saving structured copy writes to the `site_content` table
- About portrait uploads go to Supabase storage first, then write back to `about_profile_image_url`
- homepage feature picks toggle `featured_on_homepage` on visible portfolio items
- saving triggers public-page revalidation

### Creative Coach

Route: `/admin/insights`

Purpose:

- connect Instagram
- refresh cached media
- combine Instagram, booking, and portfolio data into actionable insights

Connection flow:

- obtain a short-lived token from Meta
- provide the Instagram user ID
- submit both through the admin or `POST /api/admin/instagram`
- the server exchanges the token for a long-lived one using `META_APP_SECRET`

Notes:

- the Meta app secret stays server-side only
- once connected, the page can sync media and generate suggestions from cached posts plus bookings and portfolio data

### Finance

Route: `/admin/finance`

Purpose:

- track monthly cash flow and studio splits
- log payments and variable expenses
- monitor invoice reminders
- view reporting and tax-model comparisons

Contexts currently supported:

- Malmö / Diamant studio
- Copenhagen / Good Morning Tattoo studio
- Friuli / by appointment
- Turin / Studio Etra
- Touring / guest spots

This area is operational and internal. It does not affect public copy.

### Settings

Route: `/admin/settings`

Purpose:

- manage finance context defaults
- change currencies and default fee percentages
- maintain Italy and Sweden tax settings
- manage recurring fixed costs

This page is effectively the finance configuration layer for the admin workspace.

## High-Risk Actions

Be careful with these operations:

- marking a Malmö booking as `deposit_paid`
- changing the location or appointment date of a synced Malmö booking
- cancelling a synced booking
- deleting a booking
- deleting a portfolio image
- uploading a new About portrait and forgetting to save content afterwards

## Recommended Admin Workflow

1. Review new requests in `Bookings`.
2. Add internal notes before sending approvals or declines.
3. Only mark `deposit_paid` once the Malmö appointment details are correct.
4. Use `Portfolio` for uploads and visibility.
5. Use `Site Content` for copy, portrait, and homepage feature picks.
6. Use `Creative Coach` only after Instagram is properly connected.
7. Use `Finance` and `Settings` as internal operations tools, not public-content tools.

## Ownership Split

The repo has two different operating modes:

- portfolio mode: public website, polished copy, visible case-study quality
- service-platform mode: bookings, admin, studio operations, finance, and content workflows

The admin docs exist for the second mode so future changes do not depend on memory alone.
