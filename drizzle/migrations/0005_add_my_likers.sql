CREATE OR REPLACE FUNCTION public.my_likers()
RETURNS TABLE(id uuid, first_name text, age integer, college text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.first_name,
         CASE WHEN p.birth_date IS NULL THEN NULL ELSE date_part('year', age(p.birth_date))::int END,
         CASE WHEN p.show_college THEN p.college END,
         p.photo_path
  FROM public.dandiyas d
  JOIN public.profiles p ON p.id = d.from_id
  WHERE d.to_id = auth.uid() AND d.kind = 'send'
    AND NOT EXISTS (SELECT 1 FROM public.dandiyas b WHERE b.from_id = auth.uid() AND b.to_id = d.from_id AND b.kind = 'send')
    AND NOT EXISTS (SELECT 1 FROM public.blocks bl WHERE (bl.blocker_id = auth.uid() AND bl.blocked_id = d.from_id) OR (bl.blocker_id = d.from_id AND bl.blocked_id = auth.uid()))
  ORDER BY d.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.my_likers() TO authenticated;