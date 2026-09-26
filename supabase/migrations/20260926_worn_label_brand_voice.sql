-- Lock Worn Label Society Brain DNA to website-true luxury editorial voice.
-- Entity: ff62adda-3c81-421a-9c9a-e817d4169f74

update public.entities
set
  brand_identity = coalesce(brand_identity, '{}'::jsonb) || jsonb_build_object(
    'tone', 'Understated, discerning, archival, elevated, effortlessly chic',
    'core_mission', 'Less searching. Better finding. Extending luxury fashion through verified consignment.',
    'tagline', 'Less searching. Better finding',
    'forbidden_words', jsonb_build_array(
      'MAD',
      'MAD Studio',
      'Agency',
      'Lowballers',
      'Cheap',
      'Thrifty',
      'Op-shop',
      'Disruptive',
      'Synergy',
      'Funnel'
    ),
    'vibes', jsonb_build_array(
      'Quiet Luxury',
      'Modern Muse',
      'Euro Summer Escape',
      'Coastal Creative',
      'Street Archive'
    ),
    'vibe_tags', jsonb_build_array(
      'Quiet Luxury',
      'Modern Muse',
      'Euro Summer Escape',
      'Coastal Creative',
      'Street Archive'
    )
  ),
  value_propositions = coalesce(value_propositions, '{}'::jsonb) || jsonb_build_object(
    'discovery', 'Less searching. Better finding',
    'curation', 'Quality-screened pre-loved pieces by vibe',
    'local', 'Whangārei boutique with Instagram Shop Here flow'
  ),
  content_pillars = case
    when content_pillars is null
      or content_pillars = '[]'::jsonb
      or content_pillars = 'null'::jsonb
    then jsonb_build_array(
      'Shop by Vibe edits',
      'New arrivals provenance',
      'In-store atmosphere',
      'Designer archive drops'
    )
    else content_pillars
  end,
  updated_at = now()
where id = 'ff62adda-3c81-421a-9c9a-e817d4169f74';
