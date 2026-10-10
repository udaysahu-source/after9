-- Migration 0018: Storage Photos Security Hardening & Events Policy Deduplication

-- 1. Make profile photos bucket private
-- Prevents unauthenticated direct object access via /storage/v1/object/public/photos/*
UPDATE storage.buckets SET public = false WHERE id = 'photos';

-- 2. Authorization Helper for Photo Storage Objects
-- Evaluates whether the requesting user is authorized to read a photo object:
-- - Owner can always view their own photo
-- - Active administrators can view photos
-- - Matched users can view each other's photos (chat & matches)
-- - Co-participants in the same group plan can view each other's photos
-- - Discoverable profiles can be viewed by eligible users matching audience & filter rules
CREATE OR REPLACE FUNCTION public.can_view_photo_object(p_bucket text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_owner_str text;
  v_owner_uuid uuid;
BEGIN
  IF p_bucket <> 'photos' THEN
    RETURN false;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Extract the owner folder from path (e.g. 'user-uuid/filename.jpg')
  v_owner_str := (storage.foldername(p_name))[1];
  IF v_owner_str IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_owner_uuid := v_owner_str::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  -- 1. Owner can always view own photos
  IF v_uid = v_owner_uuid THEN
    RETURN true;
  END IF;

  -- 2. Admins can view any photo
  IF public.is_admin(v_uid) THEN
    RETURN true;
  END IF;

  -- 3. Matched users can view each other's photos (chat & matches)
  IF public.is_match(v_uid, v_owner_uuid) THEN
    RETURN true;
  END IF;

  -- 4. Co-participants in the same group plan
  IF EXISTS (
    SELECT 1
    FROM public.group_plan_participants gpp1
    JOIN public.group_plan_participants gpp2 ON gpp1.plan_id = gpp2.plan_id
    WHERE gpp1.user_id = v_uid
      AND gpp2.user_id = v_owner_uuid
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = v_uid AND b.blocked_id = v_owner_uuid)
           OR (b.blocker_id = v_owner_uuid AND b.blocked_id = v_uid)
      )
  ) THEN
    RETURN true;
  END IF;

  -- 5. Discoverability & visibility rules:
  -- Target user must be approved, onboarded, discoverable, not suspended, and not blocked
  IF EXISTS (
    SELECT 1
    FROM public.profiles target
    JOIN public.profiles viewer ON viewer.id = v_uid
    WHERE target.id = v_owner_uuid
      AND target.onboarded = true
      AND target.discoverable = true
      AND target.verification_status = 'approved'
      AND COALESCE(target.is_suspended, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = v_uid AND b.blocked_id = v_owner_uuid)
           OR (b.blocker_id = v_owner_uuid AND b.blocked_id = v_uid)
      )
      AND NOT ('only_me' = ANY(target.visibility_audiences))
      AND (
        NOT target.incognito
        OR EXISTS (
          SELECT 1 FROM public.dandiyas d
          WHERE d.from_id = v_owner_uuid AND d.to_id = v_uid AND d.kind = 'send'
        )
      )
      AND (
        (
          'college' = ANY(target.visibility_audiences)
          AND target.college IS NOT NULL
          AND viewer.college IS NOT NULL
          AND lower(trim(target.college)) = lower(trim(viewer.college))
        )
        OR
        (
          'nearby' = ANY(target.visibility_audiences)
          AND target.general_area IS NOT NULL
          AND viewer.general_area IS NOT NULL
          AND lower(trim(target.general_area)) = lower(trim(viewer.general_area))
        )
        OR
        (
          'event' = ANY(target.visibility_audiences)
          AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(target.nights) tn
            JOIN jsonb_each_text(viewer.nights) vn ON vn.key = tn.key
            WHERE tn.value IN ('going', 'maybe') AND vn.value IN ('going', 'maybe')
          )
        )
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3. Storage Objects Access Policies: Least-Privilege
-- Drop previous blanket policy that granted any authenticated user SELECT access to all photos
DROP POLICY IF EXISTS "signed in can view photos" ON storage.objects;

-- Authorized authenticated users can SELECT photos based on relationship
DROP POLICY IF EXISTS "authenticated users view authorized photos" ON storage.objects;
CREATE POLICY "authenticated users view authorized photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND public.can_view_photo_object(bucket_id, name)
);

-- Public share card visitors (anon) can only SELECT approved, discoverable, public profiles
DROP POLICY IF EXISTS "anon view public share card photos" ON storage.objects;
CREATE POLICY "anon view public share card photos"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND p.photo_path = name
      AND p.public_profile_enabled = true
      AND p.discoverable = true
      AND p.onboarded = true
      AND p.verification_status = 'approved'
      AND COALESCE(p.is_suspended, false) = false
      AND NOT ('only_me' = ANY(p.visibility_audiences))
  )
);

-- Harden update own photo policy with WITH CHECK constraint
DROP POLICY IF EXISTS "update own photo" ON storage.objects;
CREATE POLICY "update own photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 4. Deduplicate public.events policies safely
-- Retains:
-- - "anon and authenticated can view active published events" (SELECT)
-- - "admins manage all events" (ALL)
DROP POLICY IF EXISTS "anyone can view active events" ON public.events;
DROP POLICY IF EXISTS "anyone can view active published events" ON public.events;
DROP POLICY IF EXISTS "admins manage events" ON public.events;
