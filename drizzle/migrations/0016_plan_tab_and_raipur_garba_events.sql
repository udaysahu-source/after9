-- Migration 0016: Plan tab, Raipur Garba events, Group Planning & Community Suggestions

DO $$
BEGIN
  ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_verification_status_check;
  ALTER TABLE public.events ADD CONSTRAINT events_verification_status_check 
    CHECK (verification_status IN ('verified', 'pending_verification', 'unverified_from_poster', 'unverified', 'draft', 'cancelled', 'expired'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Chhattisgarh';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS themes_count INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS additional_programs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS contact_unverified JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS contact_verified TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS entry_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS pass_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS min_price_inr NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_price_inr NUMERIC;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_notes TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published' 
  CHECK (publication_status IN ('published', 'draft', 'archived', 'cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'anyone can view active published events') THEN
    CREATE POLICY "anyone can view active published events" ON public.events FOR SELECT TO authenticated USING (is_active = true AND publication_status = 'published');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'admins manage all events') THEN
    CREATE POLICY "admins manage all events" ON public.events FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 2. Saved Events
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_events' AND policyname = 'users manage own saved events') THEN
    CREATE POLICY "users manage own saved events" ON public.saved_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.saved_events TO authenticated, service_role;

-- 3. Group Plans
CREATE TABLE IF NOT EXISTS public.group_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  proposed_time TEXT,
  meeting_point TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'awaiting_responses', 'confirmed', 'cancelled')),
  safety_acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_plans' AND policyname = 'creators manage group plans') THEN
    CREATE POLICY "creators manage group plans" ON public.group_plans FOR ALL TO authenticated USING (creator_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (creator_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;
END $$;
GRANT ALL ON public.group_plans TO authenticated, service_role;

-- 4. Group Plan Participants
CREATE TABLE IF NOT EXISTS public.group_plan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.group_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'left')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, user_id)
);
ALTER TABLE public.group_plan_participants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_plan_participants' AND policyname = 'participants view invitations') THEN
    CREATE POLICY "participants view invitations" ON public.group_plan_participants FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.group_plans p WHERE p.id = plan_id AND p.creator_id = auth.uid()) OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_plan_participants' AND policyname = 'plan creator invites participants') THEN
    CREATE POLICY "plan creator invites participants" ON public.group_plan_participants FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.group_plans p WHERE p.id = plan_id AND p.creator_id = auth.uid()) OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_plan_participants' AND policyname = 'participants update status') THEN
    CREATE POLICY "participants update status" ON public.group_plan_participants FOR UPDATE TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.group_plans p WHERE p.id = plan_id AND p.creator_id = auth.uid())) WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.group_plans p WHERE p.id = plan_id AND p.creator_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_plans' AND policyname = 'participants can view group plans') THEN
    CREATE POLICY "participants can view group plans" ON public.group_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.group_plan_participants gpp WHERE gpp.plan_id = id AND gpp.user_id = auth.uid()));
  END IF;
END $$;
GRANT ALL ON public.group_plan_participants TO authenticated, service_role;

-- 5. Community Event Suggestions
CREATE TABLE IF NOT EXISTS public.event_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Raipur',
  dates TEXT NOT NULL,
  venue TEXT NOT NULL,
  organizer TEXT,
  source_link TEXT,
  poster_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_suggestions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_suggestions' AND policyname = 'users manage suggestions') THEN
    CREATE POLICY "users manage suggestions" ON public.event_suggestions FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
  END IF;
END $$;
GRANT ALL ON public.event_suggestions TO authenticated, service_role;

-- 6. Event Attendance / Interest
CREATE TABLE IF NOT EXISTS public.event_attendance_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'mutual_matches' CHECK (visibility IN ('mutual_matches', 'friends', 'private')),
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.event_attendance_interests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_attendance_interests' AND policyname = 'users manage attendance interest') THEN
    CREATE POLICY "users manage attendance interest" ON public.event_attendance_interests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
GRANT ALL ON public.event_attendance_interests TO authenticated, service_role;
