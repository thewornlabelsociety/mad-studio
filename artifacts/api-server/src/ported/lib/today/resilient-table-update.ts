import type { SupabaseClient } from "@supabase/supabase-js"

type PostgrestLikeError = {
  message?: string
  code?: string
}

export function isPostgrestMissingColumnError(
  error: PostgrestLikeError | null | undefined
): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "PGRST204" ||
    msg.includes("schema cache") ||
    (msg.includes("could not find") && msg.includes("column"))
  )
}

export function isPostgrestMissingRelationError(
  error: PostgrestLikeError | null | undefined
): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "42P01" ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("daily_queue"))
  )
}

function missingColumnFromMessage(message: string): string | null {
  const quoted = message.match(/'([^']+)'\s+column/i)
  if (quoted?.[1]) return quoted[1]
  const bare = message.match(/column\s+"([^"]+)"/i)
  return bare?.[1] ?? null
}

export type FilteredUpdate = {
  error: PostgrestLikeError | null
  droppedColumns: string[]
}

export async function resilientTableUpdate(
  supabase: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
  filters: Array<[column: string, value: string]>
): Promise<FilteredUpdate> {
  const body: Record<string, unknown> = { ...payload }
  const droppedColumns: string[] = []

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (Object.keys(body).length === 0) {
      return {
        error: { message: "No updatable columns left after schema fallback." },
        droppedColumns,
      }
    }

    let query = supabase.from(table).update(body)
    for (const [column, value] of filters) {
      query = query.eq(column, value)
    }
    const { error } = await query

    if (!error) {
      return { error: null, droppedColumns }
    }

    if (!isPostgrestMissingColumnError(error)) {
      return { error, droppedColumns }
    }

    const missing = missingColumnFromMessage(error.message ?? "")
    if (missing && missing in body) {
      delete body[missing]
      droppedColumns.push(missing)
      continue
    }

    if ("updated_at" in body) {
      delete body.updated_at
      droppedColumns.push("updated_at")
      continue
    }

    return { error, droppedColumns }
  }

  return {
    error: { message: "Update failed after schema fallback retries." },
    droppedColumns,
  }
}
