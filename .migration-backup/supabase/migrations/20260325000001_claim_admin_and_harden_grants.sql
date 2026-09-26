-- Claim first org admin (empty org bootstrap)
CREATE OR REPLACE FUNCTION public.claim_first_org_admin(p_org_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  org_id := COALESCE(
    p_org_id,
    (SELECT id FROM public.organizations WHERE slug = 'mega-marketing' LIMIT 1)
  );

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_id = org_id
  ) THEN
    RAISE EXCEPTION 'Organization already has members';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, uid, 'org_admin');

  RETURN org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_org_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_first_org_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_first_org_admin(uuid) TO authenticated;

-- Harden helper search_path + grants
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and role = 'org_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_entity_access(ent_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.entities e
    join public.organization_members om on om.organization_id = e.organization_id
    where e.id = ent_id and om.user_id = auth.uid() and om.role = 'org_admin'
    union
    select 1 from public.entity_access ea
    where ea.entity_id = ent_id and ea.user_id = auth.uid() and ea.role = any(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_entity_access(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_entity_access(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_entity_access(uuid, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
