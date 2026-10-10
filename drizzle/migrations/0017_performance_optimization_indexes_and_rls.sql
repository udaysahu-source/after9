-- Performance Optimization: Foreign Key & Query Path Indexes, and Scalar Subquery RLS Hardening

-- 1. Messages conversation and reverse foreign key indexes
-- Covers chat history queries: (sender_id = A AND recipient_id = B) OR (sender_id = B AND recipient_id = A) ORDER BY created_at
-- Covers subqueries in my_matches() function
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender ON public.messages(recipient_id, sender_id, created_at ASC);

-- 2. Dandiyas reverse foreign key index
-- Primary key is (from_id, to_id). Queries checking incoming dandiyas or reciprocal matches (to_id = auth.uid()) require index coverage.
CREATE INDEX IF NOT EXISTS idx_dandiyas_to_id ON public.dandiyas(to_id, from_id);

-- 3. Blocks reverse foreign key index
-- Primary key is (blocker_id, blocked_id). Queries checking if user is blocked (blocked_id = auth.uid()) require index coverage.
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks(blocked_id, blocker_id);

-- 4. Events partial active published index
-- Plan tab queries events WHERE is_active = true AND publication_status = 'published' ORDER BY start_date ASC.
CREATE INDEX IF NOT EXISTS idx_events_active_published_start ON public.events(start_date ASC)
WHERE is_active = true AND publication_status = 'published';

-- 5. Profiles discoverable partial index
-- discover_feed() filters: onboarded = true AND discoverable = true AND verification_status = 'approved'
CREATE INDEX IF NOT EXISTS idx_profiles_discoverable ON public.profiles(gender, created_at DESC)
WHERE onboarded = true AND discoverable = true AND verification_status = 'approved';

-- 6. Hot RLS Policy Optimizations: Scalar Subqueries (SELECT auth.uid())
-- Wrapping auth.uid() in (select auth.uid()) allows Postgres to evaluate the session UID once as an InitPlan per query instead of per row.

ALTER POLICY "read own chats" ON public.messages
USING (
  (((select auth.uid()) = sender_id OR (select auth.uid()) = recipient_id))
  AND public.is_match(sender_id, recipient_id)
);

ALTER POLICY "send to match" ON public.messages
WITH CHECK (
  ((select auth.uid()) = sender_id)
  AND public.is_match(sender_id, recipient_id)
);

ALTER POLICY "own swipes" ON public.dandiyas
USING ((select auth.uid()) = from_id);

ALTER POLICY "swipe insert" ON public.dandiyas
WITH CHECK (((select auth.uid()) = from_id) AND (from_id <> to_id));

ALTER POLICY "swipe delete" ON public.dandiyas
USING ((select auth.uid()) = from_id);

ALTER POLICY "own blocks read" ON public.blocks
USING ((select auth.uid()) = blocker_id);

ALTER POLICY "own blocks write" ON public.blocks
WITH CHECK ((select auth.uid()) = blocker_id);

ALTER POLICY "own blocks delete" ON public.blocks
USING ((select auth.uid()) = blocker_id);

ALTER POLICY "own profile read" ON public.profiles
USING ((select auth.uid()) = id);

ALTER POLICY "own profile update" ON public.profiles
USING ((select auth.uid()) = id);

ALTER POLICY "own profile insert" ON public.profiles
WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "own profile delete" ON public.profiles
USING ((select auth.uid()) = id);

ALTER POLICY "users manage own saved events" ON public.saved_events
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "anyone can view active events" ON public.events
USING (is_active = true AND publication_status = 'published');
