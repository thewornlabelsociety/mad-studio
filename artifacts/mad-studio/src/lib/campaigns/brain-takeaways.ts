import type { SupabaseClient } from "@supabase/supabase-js"

/** Latest planner/pack learning lines: campaign winners + autonomous takeaway log. */
export async function loadBrainTakeawaysForEntity(
  supabase: SupabaseClient,
  entityId: string,
  limit = 5
): Promise<string[]> {
  const [{ data: campaignRows }, { data: takeawayRows }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("ai_takeaway")
      .eq("entity_id", entityId)
      .in("outcome_rating", ["winner", "loss"])
      .not("ai_takeaway", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("campaign_takeaways")
      .select("ai_takeaway")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ])

  const merged = [
    ...(takeawayRows ?? []).map((row) =>
      typeof row.ai_takeaway === "string" ? row.ai_takeaway.trim() : ""
    ),
    ...(campaignRows ?? []).map((row) =>
      typeof row.ai_takeaway === "string" ? row.ai_takeaway.trim() : ""
    ),
  ].filter(Boolean)

  const seen = new Set<string>()
  const unique: string[] = []
  for (const line of merged) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(line)
    if (unique.length >= limit) break
  }

  return unique
}
