# Content Model

This project uses more than one content source on purpose. The public site is partly static and partly CMS-driven.

## Sources Of Truth

| Source | Used for | Edited via | Deploy needed |
|--------|----------|------------|---------------|
| `messages/*.json` | locale metadata, nav labels, booking form labels, location labels, static public copy | code | Yes |
| `site_content` table | editable hero copy, About copy, About portrait URL, homepage quote, helper notes | `/admin/content` | No |
| `portfolio_images` table + storage | public portfolio, homepage preview images, homepage feature picks | `/admin/portfolio` and `/admin/content` | No |
| `supabase/migrations/*.sql` | schema changes and DB-level default/update changes | code + CLI | Yes |

## Locale Rules

- English is the canonical source for CMS-managed content.
- Italian is the only manual locale override exposed in the admin UI.
- Swedish and Danish currently mirror English in the admin workflow.
- The data model still supports `sv_override` and `da_override`, but the current UI intentionally does not expose them.
- `resolveSiteContent()` uses this order:
  1. locale override if present
  2. English source
  3. component fallback string

Important separation:

- page metadata and many interface labels still live in `messages/*.json`
- editable page body copy lives in `site_content`

That means metadata changes still require a deploy even if body copy does not.

## Current CMS-Managed Keys

These keys are defined in `src/lib/site-content.ts`.

| Key | Used on |
|-----|---------|
| `booking_italy_note` | booking page helper note |
| `about_italy_note` | About page Italy note |
| `about_bio` | homepage teaser and About bio |
| `about_profile_image_url` | About portrait |
| `about_studios_note` | About studio context paragraph |
| `about_travel_note` | About travel note |
| `home_hero_title` | homepage hero title |
| `home_hero_subtitle` | homepage hero subtitle |
| `home_quote` | homepage quote intro |
| `home_quote_highlight` | homepage quote highlight |
| `home_booking_cta_subtitle` | homepage booking CTA subtitle |

## Homepage Image Rules

- the homepage preview strip uses visible portfolio images
- if one or more images are marked `featured_on_homepage`, those are used first
- if nothing is featured, the homepage falls back to the latest visible work
- homepage feature picks are managed in `/admin/content`, not `/admin/portfolio`

## About Portrait Rules

- the public About portrait comes from `about_profile_image_url`
- the URL can be pasted manually or created by upload in `/admin/content`
- uploads are stored in Supabase storage and then written back into the CMS field
- the portrait is not published until `Save changes` is clicked

## When To Edit What

Use `/admin/content` when:

- changing homepage hero copy
- changing About body copy
- changing the About portrait
- changing the homepage quote
- changing the booking Italy note
- changing homepage feature picks

Use `messages/*.json` when:

- changing page titles and descriptions
- changing nav labels
- changing static interface copy
- changing location labels and badges
- changing booking form labels and fixed UI text
- changing aftercare content

Use a migration when:

- adding a new database-backed content key
- changing seeded defaults that should exist remotely
- performing one-off copy updates that must run against the live database

## Revalidation Behavior

Saving site content revalidates these public paths:

- `/[locale]`
- `/[locale]/about`
- `/[locale]/booking`
- `/[locale]/portfolio`

This is handled in `src/app/api/admin/content/route.ts`.

## Practical Rule Of Thumb

- if Lia should be able to change it without a deploy, it belongs in the CMS or admin-managed tables
- if it changes routing, metadata, form structure, or fixed UI labels, it belongs in code
- if it affects schema or DB defaults, it needs a migration
