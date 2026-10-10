-- Migration 0025: Fix admin user moderation, verification trigger bypass, delete policies, and RPC
-- 1. Update guard_profile to allow authenticated admins to update verification status and reasons
CREATE OR REPLACE FUNCTION public.guard_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin(auth.uid()) then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending'; new.verification_reason := null;
    else
      if new.photo_path is distinct from old.photo_path or new.prompt is distinct from old.prompt or new.first_name is distinct from old.first_name then
        new.verification_status := 'pending'; new.verification_reason := null;
      else
        new.verification_status := old.verification_status; new.verification_reason := old.verification_reason;
      end if;
    end if;
  end if;

  -- 18+ adult age validation
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    raise exception 'After9 is strictly for adults 18+';
  end if;

  -- Age preference bounds validation
  if new.min_age is not null and new.min_age < 18 then
    raise exception 'Minimum age filter cannot be lower than 18';
  end if;

  if new.max_age is not null and new.min_age is not null and new.max_age < new.min_age then
    raise exception 'Maximum age filter cannot be less than minimum age';
  end if;

  -- Ensure visibility_audiences has valid default if empty
  if new.visibility_audiences is null or cardinality(new.visibility_audiences) = 0 then
    new.visibility_audiences := array['only_me']::text[];
  end if;

  new.updated_at := now();
  return new;
end $function$;

-- 2. Add admins delete profiles RLS policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'admins delete profiles'
  ) THEN
    CREATE POLICY "admins delete profiles" 
    ON public.profiles 
    FOR DELETE 
    TO authenticated 
    USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 3. Stored Procedure: admin_moderate_user
CREATE OR REPLACE FUNCTION public.admin_moderate_user(
  p_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
BEGIN
  IF NOT public.is_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF v_caller_email IS NULL THEN
    SELECT email INTO v_caller_email FROM public.admin_users WHERE user_id = v_caller_id;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.profiles
    SET verification_status = 'approved',
        verification_reason = NULL,
        updated_at = now()
    WHERE id = p_user_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.profiles
    SET verification_status = 'rejected',
        verification_reason = coalesce(p_reason, 'Verification rejected by administrator'),
        updated_at = now()
    WHERE id = p_user_id;
  ELSIF p_action = 'suspend' THEN
    UPDATE public.profiles
    SET is_suspended = true,
        suspension_reason = coalesce(p_reason, 'Suspended by moderator for community safety guidelines violation'),
        updated_at = now()
    WHERE id = p_user_id;
  ELSIF p_action = 'reactivate' THEN
    UPDATE public.profiles
    SET is_suspended = false,
        suspension_reason = NULL,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid moderation action: %', p_action;
  END IF;

  -- Insert audit log
  INSERT INTO public.admin_audit_logs (actor_id, actor_email, action, target_id, details)
  VALUES (
    v_caller_id,
    coalesce(v_caller_email, 'admin@after9.internal'),
    'USER_' || upper(p_action),
    p_user_id::text,
    jsonb_build_object('reason', p_reason, 'action', p_action)
  );

  RETURN jsonb_build_object('ok', true, 'action', p_action, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_user(uuid, text, text) TO authenticated;
