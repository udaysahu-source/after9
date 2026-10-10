-- Migration 0026: Anti-Fake Profile and Trust System Hardening
-- 1. Private verification evidence storage bucket & least-privilege RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_evidence', 'verification_evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
BEGIN
  -- Moderator-only read access to verification evidence
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'admins view verification evidence'
  ) THEN
    CREATE POLICY "admins view verification evidence" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'verification_evidence' AND public.is_admin(auth.uid()));
  END IF;

  -- Service role full access to verification evidence
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'service role manage verification evidence'
  ) THEN
    CREATE POLICY "service role manage verification evidence" ON storage.objects
      FOR ALL TO service_role
      USING (bucket_id = 'verification_evidence')
      WITH CHECK (bucket_id = 'verification_evidence');
  END IF;
END $$;

-- 2. Restrict moderator access to private chats: drop blanket SELECT policy
DROP POLICY IF EXISTS "admins select messages" ON public.messages;

-- 3. Audited security-definer RPC for reported chat inspection
CREATE OR REPLACE FUNCTION public.admin_get_reported_messages(
  p_blocker_id uuid,
  p_blocked_id uuid
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_has_report boolean;
BEGIN
  IF NOT public.is_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  -- Verify an explicit safety report exists between these two accounts
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE b.report = true
      AND (
        (b.blocker_id = p_blocker_id AND b.blocked_id = p_blocked_id)
        OR (b.blocker_id = p_blocked_id AND b.blocked_id = p_blocker_id)
      )
  ) INTO v_has_report;

  IF NOT v_has_report THEN
    RAISE EXCEPTION 'Audited access denied: No active report filed between these accounts';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  -- Insert audit log for inspecting reported chat content
  INSERT INTO public.admin_audit_logs (actor_id, actor_email, action, target_id, details)
  VALUES (
    v_caller_id,
    coalesce(v_caller_email, 'admin@after9.internal'),
    'AUDITED_REPORT_CHAT_READ',
    p_blocker_id::text || ':' || p_blocked_id::text,
    jsonb_build_object(
      'blocker_id', p_blocker_id,
      'blocked_id', p_blocked_id,
      'justification', 'Moderation review of reported harassment/abuse'
    )
  );

  RETURN QUERY
  SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at
  FROM public.messages m
  WHERE (m.sender_id = p_blocker_id AND m.recipient_id = p_blocked_id)
     OR (m.sender_id = p_blocked_id AND m.recipient_id = p_blocker_id)
  ORDER BY m.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_reported_messages(uuid, uuid) TO authenticated;

-- 4. Server-Side Discover Feed: verified-only feed requirement for viewer
CREATE OR REPLACE FUNCTION public.discover_feed()
RETURNS TABLE (
  id uuid,
  first_name text,
  age int,
  college text,
  branch text,
  prompt text,
  photo_path text,
  nights jsonb,
  quiz jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH launch AS (
    SELECT coalesce(discover_enabled, false) AS enabled
    FROM public.launch_control
    WHERE id = 'global'
    LIMIT 1
  ),
  me AS (
    SELECT * FROM public.profiles WHERE id = auth.uid()
  ),
  eligible_candidates AS (
    SELECT
      p.id,
      p.first_name,
      date_part('year', age(p.birth_date))::int AS age,
      CASE WHEN p.show_college THEN p.college END AS college,
      CASE WHEN p.show_college THEN p.branch END AS branch,
      p.prompt,
      p.photo_path,
      p.nights,
      p.quiz,
      -- 1. Compatibility score: Shared Garba nights + quiz match
      (
        COALESCE((
          SELECT count(*)::int
          FROM jsonb_each_text(p.nights) pn
          JOIN jsonb_each_text(me.nights) mn ON mn.key = pn.key
          WHERE pn.value IN ('going', 'maybe') AND mn.value IN ('going', 'maybe')
        ), 0) * 2
        +
        CASE WHEN (p.quiz->>'energy') IS NOT NULL AND (p.quiz->>'energy') = (me.quiz->>'energy') THEN 2 ELSE 0 END
        +
        CASE WHEN (p.quiz->>'experience') IS NOT NULL AND (p.quiz->>'experience') = (me.quiz->>'experience') THEN 2 ELSE 0 END
        +
        CASE WHEN (p.quiz->>'night') IS NOT NULL AND (p.quiz->>'night') = (me.quiz->>'night') THEN 2 ELSE 0 END
      ) AS compat_score,
      -- 2. Exposure balancing: Rolling 7-day impression count across platform
      COALESCE((
        SELECT count(*)::int
        FROM public.discovery_impressions di
        WHERE di.profile_id = p.id
          AND di.served_at > (now() - interval '7 days')
      ), 0) AS platform_impressions_7d,
      -- 3. Viewer fatigue: Impressions of profile to THIS viewer
      COALESCE((
        SELECT count(*)::int
        FROM public.discovery_impressions di
        WHERE di.profile_id = p.id
          AND di.viewer_id = me.id
          AND di.served_at > (now() - interval '7 days')
      ), 0) AS viewer_impressions_7d,
      -- 4. Deterministic pseudo-random daily tie-break (0.0 to 3.0)
      (
        ((('x' || substr(md5(me.id::text || p.id::text || current_date::text), 1, 6))::bit(24)::bigint % 1000) / 1000.0) * 3.0
      ) AS tiebreak_score
    FROM public.profiles p, me, launch
    WHERE launch.enabled = true
      AND me.is_suspended = false
      AND me.onboarded = true
      AND me.verification_status = 'approved'
      AND p.is_suspended = false
      AND p.id <> me.id
      AND p.onboarded = true
      AND p.discoverable = true
      AND p.verification_status = 'approved'
      AND (NOT p.incognito OR EXISTS (
        SELECT 1 FROM public.dandiyas d WHERE d.from_id = p.id AND d.to_id = me.id AND d.kind = 'send'
      ))
      AND date_part('year', age(p.birth_date)) BETWEEN me.min_age AND me.max_age
      AND (me.interested_in = 'everyone' OR p.gender = me.interested_in)
      AND NOT EXISTS (
        SELECT 1 FROM public.dandiyas d WHERE d.from_id = me.id AND d.to_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b WHERE (b.blocker_id = me.id AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = me.id)
      )
      -- Profile Visibility Meter enforcement:
      AND NOT ('only_me' = ANY(p.visibility_audiences))
      AND (
        (
          'college' = ANY(p.visibility_audiences)
          AND p.college IS NOT NULL
          AND me.college IS NOT NULL
          AND lower(trim(p.college)) = lower(trim(me.college))
        )
        OR
        (
          'nearby' = ANY(p.visibility_audiences)
          AND p.general_area IS NOT NULL
          AND me.general_area IS NOT NULL
          AND lower(trim(p.general_area)) = lower(trim(me.general_area))
        )
        OR
        (
          'event' = ANY(p.visibility_audiences)
          AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(p.nights) pn
            JOIN jsonb_each_text(me.nights) mn ON mn.key = pn.key
            WHERE pn.value IN ('going', 'maybe') AND mn.value IN ('going', 'maybe')
          )
        )
      )
  )
  SELECT
    ec.id,
    ec.first_name,
    ec.age,
    ec.college,
    ec.branch,
    ec.prompt,
    ec.photo_path,
    ec.nights,
    ec.quiz
  FROM eligible_candidates ec
  ORDER BY (
    ec.compat_score
    + (GREATEST(0.0, 30.0 - LEAST(ec.platform_impressions_7d::numeric, 30.0)) * 0.5)
    - (ec.viewer_impressions_7d::numeric * 5.0)
    + ec.tiebreak_score
  ) DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.discover_feed() TO authenticated;

-- 5. Suspension Appeal Submission RPC
CREATE OR REPLACE FUNCTION public.submit_suspension_appeal(
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sanitized_reason text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_sanitized_reason := trim(coalesce(p_reason, ''));
  IF length(v_sanitized_reason) < 10 THEN
    RAISE EXCEPTION 'Please provide a detailed explanation for your appeal (minimum 10 characters).';
  END IF;

  IF length(v_sanitized_reason) > 1000 THEN
    v_sanitized_reason := substr(v_sanitized_reason, 1, 1000);
  END IF;

  -- Record appeal event into security_events queue for administrator review
  INSERT INTO public.security_events (event_type, severity, actor_id, metadata)
  VALUES (
    'suspension_appeal',
    'info',
    v_user_id,
    jsonb_build_object(
      'appeal_reason', v_sanitized_reason,
      'submitted_at', now()
    )
  );

  RETURN jsonb_build_object('ok', true, 'message', 'Your appeal has been submitted to the moderation team.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_suspension_appeal(text) TO authenticated;
