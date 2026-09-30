-- Seed deterministic Studio formula banks and structured conversion CTAs on entities.
-- Safe to re-run: only fills missing formula_bank; replaces conversion_goals when empty.

UPDATE public.entities
SET brand_identity = jsonb_set(
  COALESCE(brand_identity, '{}'::jsonb),
  '{formula_bank}',
  COALESCE(
    brand_identity->'formula_bank',
    '{
      "hook_styles": [
        {
          "id": "price_contrast",
          "label": "Price Shock / Value Contrast",
          "template": "Why pay retail at [Price A] when you can get [Item] for [Price B]?"
        },
        {
          "id": "curiosity_gap",
          "label": "Curiosity / Secret Insider",
          "template": "Nobody in [Location] realizes you can actually get [Item] right now..."
        },
        {
          "id": "negative_warning",
          "label": "Negative Constraint (Stop Doing X)",
          "template": "Stop doing [Painful Action] in 2026. Here is the 10-second fix:"
        },
        {
          "id": "hyper_local",
          "label": "Hyper-Local Callout",
          "template": "If you live in [City/Area] and love [Interest], do not scroll past this."
        },
        {
          "id": "behind_curtain",
          "label": "Behind the Pass / Workshop",
          "template": "Watch how we prep 40 portions of [Item] before 5:00 PM."
        }
      ],
      "visual_directions": [
        {
          "id": "tactile_close",
          "label": "Extreme Close-Up (Texture / Sizzle / Tag)",
          "cue": "Macro camera on fabric weave or sizzling butter within 0-2s."
        },
        {
          "id": "handheld_rack",
          "label": "Handheld POV Walkthrough",
          "cue": "Natural first-person perspective entering the space or pulling item."
        },
        {
          "id": "quick_cut_montage",
          "label": "3-Shot Quick Cut (Wide -> Detail -> Action)",
          "cue": "Beat 1: Wide room. Beat 2: Hero item. Beat 3: Human interaction."
        }
      ]
    }'::jsonb
  ),
  true
)
WHERE brand_identity->'formula_bank' IS NULL
   OR brand_identity->'formula_bank' = 'null'::jsonb;

UPDATE public.entities
SET conversion_goals = jsonb_build_array(
  jsonb_build_object(
    'id', 'tap_sticker',
    'label', 'Tap Link Sticker in Story',
    'action_text', 'Tap the link sticker above to inspect piece / view menu.'
  ),
  jsonb_build_object(
    'id', 'dm_hold',
    'label', 'DM "HOLD" to Reserve',
    'action_text', 'DM us "HOLD" to claim one of the few available slots.'
  ),
  jsonb_build_object(
    'id', 'save_weekend',
    'label', 'Save for Weekend Plans',
    'action_text', 'Tap save so you don''t forget where to go this Friday.'
  ),
  jsonb_build_object(
    'id', 'in_store_table',
    'label', 'Dine In / Try On In Showroom',
    'action_text', 'Pop in today before 5:00 PM to catch it in person.'
  )
)
WHERE conversion_goals IS NULL
   OR conversion_goals = '[]'::jsonb
   OR jsonb_typeof(conversion_goals) = 'null';
