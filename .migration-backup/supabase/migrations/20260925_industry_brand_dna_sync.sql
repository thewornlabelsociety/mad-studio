-- Sync industry DNA defaults for Worn Label Society + FÜDI

UPDATE public.entities
SET
  industry = 'Fashion / Apparel',
  business_model = 'B2C Consignment Boutique',
  brand_identity = jsonb_build_object(
    'tone', 'Editorial curator, quiet confidence, boutique specialist',
    'forbidden_words', jsonb_build_array('cheap', 'bargain bin', 'fast fashion', 'must-have!!!', 'OMG', 'slay'),
    'visual_vibe', 'Moody Obsidian — dark charcoal #121211, emerald #0F3B2E, bone #EDECE8; serif headlines and Shop by Vibe badges',
    'core_mission', 'Curated pre-loved fashion marketplace — quality-screened pieces, Shop by Vibe discovery, Whangārei boutique presence',
    'theme', 'Moody Obsidian',
    'tagline', 'Less searching. Better finding',
    'accent', '#0F3B2E',
    'vibe_tags', jsonb_build_array(
      'Quiet Luxury',
      'Modern Muse',
      'Euro Summer Escape',
      'Coastal Creative',
      'Street Archive'
    )
  ),
  value_propositions = jsonb_build_object(
    'discovery', 'Less searching. Better finding',
    'curation', 'Quality-screened pre-loved pieces by vibe',
    'local', 'Whangārei boutique with Instagram Shop Here flow'
  ),
  content_pillars = jsonb_build_array(
    'Shop by Vibe edits',
    'New arrivals provenance',
    'In-store atmosphere',
    'Designer archive drops'
  ),
  local_context = jsonb_build_array(
    'Worn Label Society • Whangārei',
    'Less searching. Better finding'
  ),
  website_url = COALESCE(NULLIF(website_url, ''), 'https://wornlabelsociety.co.nz/'),
  updated_at = now()
WHERE lower(name) LIKE '%worn label%';

UPDATE public.entities
SET
  industry = 'Food & Beverage',
  business_model = 'Hospitality',
  brand_identity = jsonb_build_object(
    'tone', 'Appetizing, community-led, neighborhood-focused',
    'forbidden_words', jsonb_build_array('synergy', 'disrupt', 'grab-and-go junk', 'cheap eats!!!', 'processed'),
    'visual_vibe', 'Warm Table / Kiwi Eatery — warm cream #FBF8F3, terracotta #E05A36, dark roast #241C18; full-bleed food photography',
    'core_mission', 'Neighborhood hospitality — craving-led specials, chef/table stories, community invites around the local table',
    'theme', 'Warm Table / Kiwi Eatery',
    'tagline', 'Bold flavours, local roots',
    'accent', '#E05A36',
    'vibe_tags', jsonb_build_array(
      'Neighborhood Special',
      'Chef''s Table',
      'Weekend Brunch',
      'Local Harvest',
      'Late Bite'
    )
  ),
  value_propositions = jsonb_build_object(
    'community', 'Neighborhood table energy',
    'flavour', 'Bold flavours, local roots',
    'hospitality', 'Chef-led specials worth sharing'
  ),
  content_pillars = jsonb_build_array(
    'Daily / weekend specials',
    'Chef stories',
    'Neighborhood community',
    'Seasonal harvest plates'
  ),
  local_context = jsonb_build_array(
    'FÜDI • Your neighborhood table',
    'Bold flavours, local roots'
  ),
  updated_at = now()
WHERE lower(name) LIKE '%füdi%'
   OR lower(name) LIKE '%fudi%';
