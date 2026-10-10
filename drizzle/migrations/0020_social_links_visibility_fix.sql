-- Migration 0020: Ensure social_links visibility column, check constraints, RLS policies, and schema cache reload
-- Fixes: "Could not find the 'visibility' column of 'social_links' in the schema cache"

-- 1. Ensure visibility column exists with default 'private'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'social_links' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.social_links 
      ADD COLUMN visibility text NOT NULL DEFAULT 'private';
  END IF;
END $$;

-- 2. Ensure constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.social_links'::regclass AND conname = 'social_links_visibility_check'
  ) THEN
    ALTER TABLE public.social_links 
      ADD CONSTRAINT social_links_visibility_check 
      CHECK (visibility IN ('private', 'share_card', 'matched'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.social_links'::regclass AND conname = 'social_links_platform_check'
  ) THEN
    ALTER TABLE public.social_links 
      ADD CONSTRAINT social_links_platform_check 
      CHECK (platform IN ('instagram', 'snapchat', 'youtube', 'x', 'linkedin', 'custom'));
  END IF;
END $$;

-- 3. Row Level Security policies
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'social_links' AND policyname = 'matched users view mutual connections'
  ) THEN
    CREATE POLICY "matched users view mutual connections"
      ON public.social_links
      FOR SELECT
      TO authenticated
      USING (
        is_enabled = true
        AND visibility = 'matched'
        AND EXISTS (
          SELECT 1 FROM public.my_matches() m
          WHERE m.id = social_links.user_id
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;

-- 4. Server-side RPC functions for matched connections
CREATE OR REPLACE FUNCTION public.get_matched_socials(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.is_match(auth.uid(), target_user_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'platform', s.platform,
      'handle', s.handle,
      'profile_url', s.profile_url
    )
  ), '[]'::jsonb)
  INTO v_res
  FROM public.social_links s
  WHERE s.user_id = target_user_id
    AND s.is_enabled = true
    AND s.visibility = 'matched';

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_matched_socials(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_match_social_links(_target_user_id uuid)
RETURNS TABLE (
  platform text,
  handle text,
  profile_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.platform, s.handle, s.profile_url
  FROM public.social_links s
  WHERE s.user_id = _target_user_id
    AND s.is_enabled = true
    AND s.visibility = 'matched'
    AND EXISTS (
      SELECT 1 FROM public.my_matches() m
      WHERE m.id = _target_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_match_social_links(uuid) TO authenticated;

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
