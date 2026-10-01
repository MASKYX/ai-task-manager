CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    calendar_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    updated_at TIMESTAMPTZ NOT NULL,
    ai_requests_remaining INTEGER NOT NULL DEFAULT 20,
    ai_quota_date DATE
);

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    refresh_token TEXT,
    access_token TEXT,
    expires_at TIMESTAMPTZ,
    scope VARCHAR(255),
    revoked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20);

UPDATE public.users AS users
SET calendar_provider = CASE
    WHEN EXISTS (
        SELECT 1
        FROM public.google_oauth_tokens AS tokens
        WHERE tokens.user_id = users.id
          AND tokens.revoked_at IS NULL
    ) THEN 'GOOGLE'
    ELSE 'LOCAL'
END
WHERE calendar_provider IS NULL;

ALTER TABLE public.users
    ALTER COLUMN calendar_provider SET DEFAULT 'LOCAL',
    ALTER COLUMN calendar_provider SET NOT NULL;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS ai_requests_remaining INTEGER,
    ADD COLUMN IF NOT EXISTS ai_quota_date DATE;

UPDATE public.users
SET ai_requests_remaining = 20
WHERE ai_requests_remaining IS NULL;

ALTER TABLE public.users
    ALTER COLUMN ai_requests_remaining SET DEFAULT 20,
    ALTER COLUMN ai_requests_remaining SET NOT NULL;

ALTER TABLE public.google_oauth_tokens
    ALTER COLUMN refresh_token TYPE TEXT,
    ALTER COLUMN access_token TYPE TEXT;

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary VARCHAR(255),
    description TEXT,
    start_date_time TIMESTAMPTZ NOT NULL,
    end_date_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_dates
    ON public.calendar_events (user_id, start_date_time, end_date_time);

CREATE TABLE IF NOT EXISTS public.demo_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires_at
    ON public.demo_sessions (expires_at);
