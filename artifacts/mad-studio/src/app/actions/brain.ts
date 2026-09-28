"use server"

import { revalidatePath } from "next/cache"

import { assertBrainEntityAccess } from "@/lib/brain/entity-access"
import {
  guessDocType,
  type QuoteSource,
} from "@/lib/brain/types"
import { extractDnaFromWebsite } from "@/lib/entities/extract-dna"
import {
  audienceSegmentSchema,
  brandIdentitySchema,
  entityDnaSchema,
  type AudienceSegment,
  type BrandIdentity,
  type EntityDna,
} from "@/lib/entities/dna-schema"
import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string }

async function assertCanEdit(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." }
  }

  const access = await assertBrainEntityAccess({
    supabase,
    userId: user.id,
    entityId,
    mode: "edit",
  })
  if (!access.ok) {
    return { supabase, user, error: access.error }
  }

  return { supabase, user, error: null as null }
}

function revalidateBrain(entityId: string) {
  revalidatePath("/brain")
  revalidatePath(`/brain?eid=${entityId}`)
  revalidatePath(`/brain?entityId=${entityId}`)
  revalidatePath("/studio")
  revalidatePath(`/studio?eid=${entityId}`)
}

export async function saveEntityDna(input: {
  entityId: string
  brandIdentity: BrandIdentity
  audienceSegments: AudienceSegment[]
  industry?: string
  businessModel?: string
}): Promise<ActionResult> {
  const identity = brandIdentitySchema.safeParse(input.brandIdentity)
  if (!identity.success) {
    return { ok: false, error: "Brand identity is incomplete." }
  }

  const audiences = input.audienceSegments
    .map((segment) => audienceSegmentSchema.safeParse(segment))
    .filter((result) => result.success)
    .map((result) => result.data)

  if (audiences.length === 0) {
    return { ok: false, error: "Add at least one audience segment." }
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { error } = await auth.supabase
    .from("entities")
    .update({
      brand_identity: identity.data as unknown as Json,
      audience_segments: audiences as unknown as Json,
      ...(input.industry ? { industry: input.industry } : {}),
      ...(input.businessModel ? { business_model: input.businessModel } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true }
}

export async function saveVisualPresets(input: {
  entityId: string
  visualPresets: {
    canvas_color: string
    accent_color: string
    text_color: string
    font_family: string
  }
}): Promise<ActionResult<{ brandIdentity: BrandIdentity }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { data: row, error: readError } = await auth.supabase
    .from("entities")
    .select("brand_identity")
    .eq("id", input.entityId)
    .single()

  if (readError || !row) {
    return { ok: false, error: readError?.message ?? "Entity not found." }
  }

  const current =
    row.brand_identity &&
    typeof row.brand_identity === "object" &&
    !Array.isArray(row.brand_identity)
      ? (row.brand_identity as Record<string, unknown>)
      : {}

  const parsed = brandIdentitySchema.safeParse({
    tone: typeof current.tone === "string" ? current.tone : "",
    forbidden_words: Array.isArray(current.forbidden_words)
      ? current.forbidden_words
      : [],
    visual_vibe:
      typeof current.visual_vibe === "string" ? current.visual_vibe : "",
    core_mission:
      typeof current.core_mission === "string" ? current.core_mission : "",
    vibes: Array.isArray(current.vibes) ? current.vibes : [],
    tagline: typeof current.tagline === "string" ? current.tagline : "",
    visual_presets: input.visualPresets,
  })

  if (!parsed.success) {
    return { ok: false, error: "Visual presets are incomplete or invalid." }
  }

  const { error } = await auth.supabase
    .from("entities")
    .update({
      brand_identity: parsed.data as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  revalidatePath("/inventory")
  return { ok: true, data: { brandIdentity: parsed.data } }
}

/** Commit a full scraped DNA Matrix into the Brain Lab (intake wizard Step 3). */
export async function commitScrapedDna(input: {
  entityId: string
  websiteUrl?: string
  dna: EntityDna
}): Promise<ActionResult<{ dna: EntityDna }>> {
  const parsed = entityDnaSchema.safeParse(input.dna)
  if (!parsed.success) {
    return { ok: false, error: "DNA matrix is incomplete. Re-run intake." }
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const dna = parsed.data
  const { error } = await auth.supabase
    .from("entities")
    .update({
      ...(input.websiteUrl ? { website_url: input.websiteUrl } : {}),
      industry: dna.industry,
      business_model: dna.business_model,
      brand_identity: dna.brand_identity as unknown as Json,
      audience_segments: dna.audience_segments as unknown as Json,
      value_propositions: dna.value_propositions as unknown as Json,
      conversion_goals: dna.conversion_goals as unknown as Json,
      content_pillars: dna.content_pillars as unknown as Json,
      local_context: dna.local_context as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true, data: { dna } }
}

export async function resyncDnaFromWebsite(
  entityId: string
): Promise<ActionResult<{ dna: EntityDna; sourceUrl: string }>> {
  const auth = await assertCanEdit(entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { data: entity, error: entityError } = await auth.supabase
    .from("entities")
    .select("id, name, website_url")
    .eq("id", entityId)
    .single()

  if (entityError || !entity) {
    return { ok: false, error: entityError?.message ?? "Entity not found." }
  }

  if (!entity.website_url) {
    return {
      ok: false,
      error: "This brand has no website URL saved. Add one before re-syncing.",
    }
  }

  try {
    const { dna, sourceUrl } = await extractDnaFromWebsite({
      name: entity.name,
      url: entity.website_url,
    })

    const { error: updateError } = await auth.supabase
      .from("entities")
      .update({
        website_url: sourceUrl,
        industry: dna.industry,
        business_model: dna.business_model,
        brand_identity: dna.brand_identity as unknown as Json,
        audience_segments: dna.audience_segments as unknown as Json,
        value_propositions: dna.value_propositions as unknown as Json,
        conversion_goals: dna.conversion_goals as unknown as Json,
        content_pillars: dna.content_pillars as unknown as Json,
        local_context: dna.local_context as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entityId)

    if (updateError) {
      return { ok: false, error: updateError.message }
    }

    revalidateBrain(entityId)
    return { ok: true, data: { dna, sourceUrl } }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to re-sync DNA from website.",
    }
  }
}

export async function uploadEntityDocument(formData: FormData): Promise<
  ActionResult<{
    id: string
    title: string
    extracted_knowledge: string
  }>
> {
  const entityId = String(formData.get("entityId") ?? "")
  const file = formData.get("file")

  if (!entityId || !(file instanceof File)) {
    return { ok: false, error: "Entity and file are required." }
  }

  const auth = await assertCanEdit(entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let knowledge: string
  try {
    const { extractDocumentKnowledge } = await import(
      "@/lib/brain/extract-document"
    )
    knowledge = await extractDocumentKnowledge({
      buffer,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
    })
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to extract document.",
    }
  }

  const path = `${entityId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`
  const { error: uploadError } = await auth.supabase.storage
    .from("entity-assets")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return { ok: false, error: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = auth.supabase.storage.from("entity-assets").getPublicUrl(path)

  const { data, error } = await auth.supabase
    .from("entity_documents")
    .insert({
      entity_id: entityId,
      title: file.name,
      file_url: publicUrl,
      extracted_knowledge: knowledge,
      doc_type: guessDocType(file.name),
    })
    .select("id, title, extracted_knowledge")
    .single()

  if (error || !data) {
    await auth.supabase.storage.from("entity-assets").remove([path])
    return { ok: false, error: error?.message ?? "Failed to save document." }
  }

  await auth.supabase.from("activity_logs").insert({
    entity_id: entityId,
    user_id: auth.user.id,
    action: "uploaded_document",
    details: { document_id: data.id, title: data.title },
  })

  revalidateBrain(entityId)
  return { ok: true, data }
}

export async function deleteEntityDocument(input: {
  entityId: string
  documentId: string
}): Promise<ActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { data: doc, error: fetchError } = await auth.supabase
    .from("entity_documents")
    .select("id, file_url")
    .eq("id", input.documentId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !doc) {
    return { ok: false, error: fetchError?.message ?? "Document not found." }
  }

  const marker = "/entity-assets/"
  const idx = doc.file_url.indexOf(marker)
  if (idx >= 0) {
    const objectPath = decodeURIComponent(
      doc.file_url.slice(idx + marker.length)
    )
    await auth.supabase.storage.from("entity-assets").remove([objectPath])
  }

  const { error } = await auth.supabase
    .from("entity_documents")
    .delete()
    .eq("id", input.documentId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true }
}

export async function addCustomerQuote(input: {
  entityId: string
  quoteText: string
  source: QuoteSource
}): Promise<ActionResult<{ id: string }>> {
  const quoteText = input.quoteText.trim()
  if (!quoteText) {
    return { ok: false, error: "Quote text is required." }
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data, error } = await auth.supabase
    .from("entity_customer_quotes")
    .insert({
      entity_id: input.entityId,
      quote_text: quoteText,
      source: input.source,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save quote." }
  }

  revalidateBrain(input.entityId)
  return { ok: true, data }
}

export async function deleteCustomerQuote(input: {
  entityId: string
  quoteId: string
}): Promise<ActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { error } = await auth.supabase
    .from("entity_customer_quotes")
    .delete()
    .eq("id", input.quoteId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true }
}

export async function updateCampaignTakeaway(input: {
  entityId: string
  campaignId: string
  aiTakeaway: string
}): Promise<ActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const takeaway = input.aiTakeaway.trim()
  if (!takeaway) {
    return { ok: false, error: "Takeaway cannot be empty." }
  }

  const { error } = await auth.supabase
    .from("campaigns")
    .update({
      ai_takeaway: takeaway,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.campaignId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true }
}

export async function clearCampaignTakeaway(input: {
  entityId: string
  campaignId: string
}): Promise<ActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error) {
    return { ok: false, error: auth.error }
  }

  const { error } = await auth.supabase
    .from("campaigns")
    .update({
      ai_takeaway: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.campaignId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateBrain(input.entityId)
  return { ok: true }
}

export async function validateDnaShape(dna: unknown) {
  return entityDnaSchema.safeParse(dna)
}
