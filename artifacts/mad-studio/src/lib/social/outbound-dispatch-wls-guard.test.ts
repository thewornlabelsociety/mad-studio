import assert from "node:assert/strict"
import { test } from "node:test"

import { WLS_DEFAULT_ENTITY_ID } from "./outbound-dispatch"

test("WLS_DEFAULT_ENTITY_ID is a stable UUID used for Meta env fallback guard", () => {
  assert.match(
    WLS_DEFAULT_ENTITY_ID,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  )
  // Must not match FÜDI marketing entity used for intake isolation.
  assert.notEqual(
    WLS_DEFAULT_ENTITY_ID,
    "ac5ec175-12c6-416e-9cce-fbcafee32b77"
  )
})
