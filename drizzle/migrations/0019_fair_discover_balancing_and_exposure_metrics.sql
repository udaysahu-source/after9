-- Migration 0019: Fair Discover Balancing, Exposure Instrumentation, and Admin Balance Analytics

-- ==============================================================================
-- 1. DISCOVERY IMPRESSIONS TRACKING TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.discovery_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id text,
  served_at timestamptz NOT NULL DEFAULT now()
);

-- Query path & window indexes
CREATE INDEX IF NOT EXISTS idx_disc_imp_profile_window 
  ON public.discovery_impressions (profile_id, served_at DESC);

CREATE INDEX IF NOT EXISTS idx_disc_imp_viewer_profile 
  ON public.discovery_impressions (viewer_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_disc_imp_viewer_served 
  ON public.discovery_impressions (viewer_id, served_at DESC);

CREATE INDEX IF NOT EXISTS idx_disc_imp_batch_profile 
  ON public.discovery_impressions (batch_id, profile_id);

-- Row Level Security
ALTER TABLE public.discovery_impressions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.discovery_impressions TO service_role;
GRANT SELECT, INSERT ON public.discovery_impressions TO authenticated;

DROP POLICY IF EXISTS "insert own impressions" ON public.discovery_impressions;
CREATE POLICY "insert own impressions" ON public.discovery_impressions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = viewer_id);

DROP POLICY IF EXISTS "admins read impressions" ON public.discovery_impressions;
CREATE POLICY "admins read impressions" ON public.discovery_impressions
  FOR SELECT TO authenticated
  USING (public.is_admin((select auth.uid())));


-- ==============================================================================
-- 2. TAMPER-RESISTANT IMPRESSION RECORDING RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_discovery_impressions(
  p_profile_ids uuid[],
  p_batch_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_id uuid;
  v_inserted_count integer := 0;
  v_target_id uuid;
  v_clean_batch text;
BEGIN
  v_viewer_id := auth.uid();
  IF v_viewer_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_profile_ids IS NULL OR array_length(p_profile_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_clean_batch := substr(coalesce(p_batch_id, ''), 1, 64);

  -- Deduplicate against duplicate render bursts or quick retries (15m window or same batch_id)
  FOREACH v_target_id IN ARRAY p_profile_ids LOOP
    IF v_target_id IS NOT NULL AND v_target_id <> v_viewer_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.discovery_impressions
        WHERE viewer_id = v_viewer_id
          AND profile_id = v_target_id
          AND (
            (v_clean_batch <> '' AND batch_id = v_clean_batch)
            OR served_at > (now() - interval '15 minutes')
          )
      ) THEN
        INSERT INTO public.discovery_impressions (viewer_id, profile_id, batch_id, served_at)
        VALUES (v_viewer_id, v_target_id, nullif(v_clean_batch, ''), now());
        v_inserted_count := v_inserted_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_discovery_impressions(uuid[], text) TO authenticated;


-- ==============================================================================
-- 3. ADAPTIVE, FAIR DISCOVER FEED RPC (100% ELIGIBILITY PRESERVED)
-- ==============================================================================
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
    + (GREATEST(0.0, 30.0 - LEAST(ec.platform_impressions_7d::numeric, 30.0)) * 0.5) -- Under-exposed boost (max +15)
    - (ec.viewer_impressions_7d::numeric * 5.0)                                     -- Viewer fatigue penalty
    + ec.tiebreak_score                                                             -- Deterministic daily tie-breaker
  ) DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.discover_feed() TO authenticated;


-- ==============================================================================
-- 4. ADMIN-ONLY DISCOVERY BALANCE & FAIRNESS ANALYTICS RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_discovery_balance_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_is_admin boolean;
  v_pool_size integer;
  v_active_24h integer;
  v_active_7d integer;
  v_total_imp_7d integer;
  v_repeat_imp_7d integer;
  v_repeated_rate numeric;
  v_total_active_viewers integer;
  v_exhausted_viewers integer;
  v_exhaustion_rate numeric;
  v_send_count integer;
  v_total_swipes integer;
  v_pos_swipe_rate numeric;
  v_mutual_matches_7d integer;
  v_dist_p10 numeric := 0;
  v_dist_p25 numeric := 0;
  v_dist_p50 numeric := 0;
  v_dist_p75 numeric := 0;
  v_dist_p90 numeric := 0;
  v_dist_max numeric := 0;
  v_dist_avg numeric := 0;
  v_gender_data jsonb;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := public.is_admin(v_caller);
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
  END IF;

  -- 1. Eligible discovery pool size
  SELECT count(*)::integer INTO v_pool_size
  FROM public.profiles
  WHERE onboarded = true
    AND discoverable = true
    AND verification_status = 'approved'
    AND is_suspended = false
    AND NOT ('only_me' = ANY(visibility_audiences));

  -- 2. Active discoverable profiles over rolling window
  SELECT count(DISTINCT profile_id)::integer INTO v_active_24h
  FROM public.discovery_impressions
  WHERE served_at > (now() - interval '24 hours');

  SELECT count(DISTINCT profile_id)::integer INTO v_active_7d
  FROM public.discovery_impressions
  WHERE served_at > (now() - interval '7 days');

  -- 3. Profile exposure distribution (7d)
  WITH profile_counts AS (
    SELECT p.id, COALESCE(count(di.id), 0)::numeric AS cnt
    FROM public.profiles p
    LEFT JOIN public.discovery_impressions di 
      ON di.profile_id = p.id AND di.served_at > (now() - interval '7 days')
    WHERE p.onboarded = true
      AND p.discoverable = true
      AND p.verification_status = 'approved'
      AND p.is_suspended = false
      AND NOT ('only_me' = ANY(p.visibility_audiences))
    GROUP BY p.id
  )
  SELECT
    COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY cnt), 0)::numeric,
    COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY cnt), 0)::numeric,
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY cnt), 0)::numeric,
    COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY cnt), 0)::numeric,
    COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY cnt), 0)::numeric,
    COALESCE(max(cnt), 0)::numeric,
    COALESCE(round(avg(cnt), 1), 0)::numeric
  INTO v_dist_p10, v_dist_p25, v_dist_p50, v_dist_p75, v_dist_p90, v_dist_max, v_dist_avg
  FROM profile_counts;

  -- 4. Repeated-exposure rate (7d)
  -- Share of impressions where viewer had already been served this profile previously
  WITH tagged_impressions AS (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY viewer_id, profile_id ORDER BY served_at ASC) AS seq
    FROM public.discovery_impressions
    WHERE served_at > (now() - interval '7 days')
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE seq > 1)::integer
  INTO v_total_imp_7d, v_repeat_imp_7d
  FROM tagged_impressions;

  IF v_total_imp_7d > 0 THEN
    v_repeated_rate := round((v_repeat_imp_7d::numeric / v_total_imp_7d::numeric) * 100.0, 1);
  ELSE
    v_repeated_rate := 0.0;
  END IF;

  -- 5. Feed exhaustion rate
  -- Active discovery viewers who currently have 0 eligible unswiped candidates
  WITH active_viewers AS (
    SELECT DISTINCT viewer_id AS uid
    FROM public.discovery_impressions
    WHERE served_at > (now() - interval '7 days')
  ),
  viewer_unswiped AS (
    SELECT
      av.uid,
      EXISTS (
        SELECT 1
        FROM public.profiles candidate
        WHERE candidate.id <> av.uid
          AND candidate.onboarded = true
          AND candidate.discoverable = true
          AND candidate.verification_status = 'approved'
          AND candidate.is_suspended = false
          AND NOT ('only_me' = ANY(candidate.visibility_audiences))
          AND NOT EXISTS (
            SELECT 1 FROM public.dandiyas d WHERE d.from_id = av.uid AND d.to_id = candidate.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b WHERE (b.blocker_id = av.uid AND b.blocked_id = candidate.id) OR (b.blocker_id = candidate.id AND b.blocked_id = av.uid)
          )
      ) AS has_candidates
    FROM active_viewers av
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE NOT has_candidates)::integer
  INTO v_total_active_viewers, v_exhausted_viewers
  FROM viewer_unswiped;

  IF v_total_active_viewers > 0 THEN
    v_exhaustion_rate := round((v_exhausted_viewers::numeric / v_total_active_viewers::numeric) * 100.0, 1);
  ELSE
    v_exhaustion_rate := 0.0;
  END IF;

  -- 6. Positive-swipe & mutual-match rates (7d)
  SELECT
    count(*) FILTER (WHERE kind = 'send')::integer,
    count(*)::integer
  INTO v_send_count, v_total_swipes
  FROM public.dandiyas
  WHERE created_at > (now() - interval '7 days');

  IF v_total_swipes > 0 THEN
    v_pos_swipe_rate := round((v_send_count::numeric / v_total_swipes::numeric) * 100.0, 1);
  ELSE
    v_pos_swipe_rate := 0.0;
  END IF;

  SELECT count(*)::integer INTO v_mutual_matches_7d
  FROM public.dandiyas d1
  JOIN public.dandiyas d2 ON d1.from_id = d2.to_id AND d1.to_id = d2.from_id
  WHERE d1.kind = 'send' AND d2.kind = 'send'
    AND d1.from_id < d1.to_id
    AND d1.created_at > (now() - interval '7 days');

  -- 7. Gender breakdown with strict k >= 10 cohort threshold for privacy protection
  WITH gender_groups AS (
    SELECT
      coalesce(nullif(trim(p.gender), ''), 'unspecified') AS g_name,
      count(*)::integer AS g_count,
      COALESCE((
        SELECT count(*)::integer
        FROM public.discovery_impressions di
        JOIN public.profiles target ON target.id = di.profile_id
        WHERE target.gender = p.gender
          AND di.served_at > (now() - interval '7 days')
      ), 0) AS g_impressions
    FROM public.profiles p
    WHERE p.onboarded = true
      AND p.discoverable = true
      AND p.verification_status = 'approved'
      AND p.is_suspended = false
      AND NOT ('only_me' = ANY(p.visibility_audiences))
    GROUP BY p.gender
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'gender', g_name,
      'is_suppressed', (g_count < 10),
      'eligible_count', CASE WHEN g_count >= 10 THEN g_count ELSE NULL END,
      'impressions_7d', CASE WHEN g_count >= 10 THEN g_impressions ELSE NULL END,
      'privacy_note', CASE WHEN g_count < 10 THEN 'Suppressed: cohort size < 10 (k-anonymity privacy protection)' ELSE NULL END
    )
  ) INTO v_gender_data
  FROM gender_groups;

  RETURN jsonb_build_object(
    'eligible_pool_size', v_pool_size,
    'active_discoverable_24h', v_active_24h,
    'active_discoverable_7d', v_active_7d,
    'exposure_distribution', jsonb_build_object(
      'p10', v_dist_p10,
      'p25', v_dist_p25,
      'median_p50', v_dist_p50,
      'p75', v_dist_p75,
      'p90', v_dist_p90,
      'max', v_dist_max,
      'avg', v_dist_avg
    ),
    'repeated_exposure_rate', v_repeated_rate,
    'feed_exhaustion_rate', v_exhaustion_rate,
    'positive_swipe_rate', v_pos_swipe_rate,
    'mutual_matches_7d', v_mutual_matches_7d,
    'gender_breakdown', coalesce(v_gender_data, '[]'::jsonb),
    'min_cohort_threshold', 10
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_discovery_balance_metrics() TO authenticated;
