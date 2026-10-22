import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../supabase/migrations/20261023_entity_template_engine.sql"
)

test("RLS migration enforces entity isolation and immutable starters/versions", () => {
  const sql = readFileSync(migrationPath, "utf8")

  for (const table of [
    "platform_template_defs",
    "entity_template_instances",
    "entity_template_versions",
    "entity_creative_recipes",
  ]) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)
    )
  }

  // Starters: SELECT only for authenticated (no INSERT/UPDATE/DELETE policies).
  assert.match(sql, /Authenticated users can view published starter templates/)
  assert.doesNotMatch(
    sql,
    /ON public\.platform_template_defs[\s\S]{0,80}FOR INSERT/
  )
  assert.doesNotMatch(
    sql,
    /ON public\.platform_template_defs[\s\S]{0,80}FOR UPDATE/
  )

  // Instances require has_entity_access with entity_id.
  assert.match(sql, /Entity members can view template instances/)
  assert.match(sql, /Entity editors can insert template instances/)
  assert.match(sql, /Entity editors can update template instances/)
  assert.match(
    sql,
    /entity_template_instances[\s\S]*has_entity_access\(\s*entity_id/
  )

  // Versions: SELECT + INSERT only (append-only for clients).
  assert.match(sql, /Entity editors can insert template versions/)
  assert.doesNotMatch(
    sql,
    /ON public\.entity_template_versions[\s\S]{0,120}FOR UPDATE/
  )
  assert.doesNotMatch(
    sql,
    /ON public\.entity_template_versions[\s\S]{0,120}FOR DELETE/
  )

  // Attribution columns + idempotency unique index (partial: null keys allowed).
  assert.match(sql, /ADD COLUMN IF NOT EXISTS template_instance_id/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS template_version_id/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS template_generation_key/)
  assert.match(sql, /idx_campaigns_entity_generation_key/)
  assert.match(
    sql,
    /ON public\.campaigns\(entity_id, template_generation_key\)[\s\S]*WHERE template_generation_key IS NOT NULL/
  )

  // Same-entity integrity triggers (recipes, versions, campaign attribution).
  assert.match(sql, /enforce_creative_recipe_same_entity/)
  assert.match(sql, /enforce_template_version_entity_match/)
  assert.match(sql, /enforce_campaign_template_attribution_entity/)
  assert.match(sql, /cross-entity recipe campaign reference rejected/)

  // Viewers can SELECT but INSERT policy roles exclude viewer.
  const insertPolicy = sql.match(
    /CREATE POLICY "Entity editors can insert template instances"[\s\S]*?CREATE POLICY/
  )?.[0]
  assert.ok(insertPolicy, "insert policy block missing")
  assert.match(
    insertPolicy,
    /ARRAY\['entity_manager'::text, 'creator'::text\]/
  )
  assert.doesNotMatch(insertPolicy, /'viewer'/)
})
