-- Instagram Graph API cache tables
-- Stores media + insights data to avoid hammering the Instagram API.
-- Token storage for long-lived token management.

-- ── Token storage ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instagram_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'long_lived',
  expires_at timestamptz NOT NULL,
  instagram_user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one token row — enforce with unique constraint on a constant
ALTER TABLE instagram_tokens ADD CONSTRAINT one_token_only UNIQUE (token_type);

-- RLS: service_role only (admin operations)
ALTER TABLE instagram_tokens ENABLE ROW LEVEL SECURITY;

-- ── Media cache ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instagram_media_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_id text NOT NULL UNIQUE,
  media_type text NOT NULL,
  caption text,
  permalink text NOT NULL,
  media_url text NOT NULL,
  thumbnail_url text,
  timestamp timestamptz NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  impressions integer,
  reach integer,
  engagement integer,
  saved integer,
  shares integer,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_ig_cache_timestamp ON instagram_media_cache (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ig_cache_fetched_at ON instagram_media_cache (fetched_at DESC);

-- RLS: service_role only
ALTER TABLE instagram_media_cache ENABLE ROW LEVEL SECURITY;

-- ── Comments ─────────────────────────────────────────────
-- No anon/authenticated policies needed — these tables are only
-- accessed server-side via the service_role key.
-- The admin API route handles auth checks before querying.
