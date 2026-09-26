-- Accept invitation as authenticated user (bypasses membership insert RLS)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invitations%ROWTYPE;
  uid uuid := auth.uid();
  user_email text;
  result_entity_id uuid;
  org_role text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv
  FROM public.invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  IF inv.email IS NOT NULL AND lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'This invitation was issued for a different email address';
  END IF;

  IF inv.role = 'org_admin' OR (inv.role = 'viewer' AND inv.entity_id IS NULL) THEN
    org_role := CASE WHEN inv.role = 'org_admin' THEN 'org_admin' ELSE 'viewer' END;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (inv.organization_id, uid, org_role)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    result_entity_id := inv.entity_id;
    IF result_entity_id IS NULL THEN
      SELECT id INTO result_entity_id
      FROM public.entities
      WHERE organization_id = inv.organization_id
      ORDER BY created_at
      LIMIT 1;
    END IF;
  ELSE
    IF inv.entity_id IS NULL THEN
      RAISE EXCEPTION 'Entity scoping is required for role %', inv.role;
    END IF;

    IF inv.role NOT IN ('entity_manager', 'creator', 'viewer') THEN
      RAISE EXCEPTION 'Unsupported invitation role: %', inv.role;
    END IF;

    INSERT INTO public.entity_access (entity_id, user_id, role)
    VALUES (inv.entity_id, uid, inv.role)
    ON CONFLICT (entity_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    result_entity_id := inv.entity_id;
  END IF;

  UPDATE public.invitations
  SET accepted_at = timezone('utc', now())
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'entity_id', result_entity_id,
    'organization_id', inv.organization_id,
    'role', inv.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

DROP POLICY IF EXISTS "Org admin insert entities" ON public.entities;
CREATE POLICY "Org admin insert entities"
  ON public.entities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

INSERT INTO public.organizations (name, slug, primary_color)
SELECT 'Mega Marketing', 'mega-marketing', '#0F172A'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'mega-marketing');

INSERT INTO public.entities (organization_id, name, industry, business_model, brand_identity)
SELECT o.id, v.name, v.industry, v.business_model, v.brand_identity::jsonb
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Worn Label Society', 'Fashion / Apparel', 'DTC', '{"tagline":"Streetwear with heritage","accent":"#1C1917"}'),
    ('FÜDI', 'Food & Beverage', 'Hospitality', '{"tagline":"Bold flavours, local roots","accent":"#B45309"}'),
    ('JOE', 'Consumer Brand', 'DTC', '{"tagline":"Everyday essentials elevated","accent":"#0EA5E9"}')
) AS v(name, industry, business_model, brand_identity)
WHERE o.slug = 'mega-marketing'
  AND NOT EXISTS (
    SELECT 1 FROM public.entities e
    WHERE e.organization_id = o.id AND e.name = v.name
  );
