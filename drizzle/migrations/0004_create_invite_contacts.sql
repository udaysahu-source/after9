CREATE TABLE public.invite_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT REFERENCES public.invites(code),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_contacts TO authenticated;
GRANT ALL ON public.invite_contacts TO service_role;
ALTER TABLE public.invite_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts read" ON public.invite_contacts FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own contacts write" ON public.invite_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own contacts update" ON public.invite_contacts FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own contacts delete" ON public.invite_contacts FOR DELETE TO authenticated USING (auth.uid() = owner_id);