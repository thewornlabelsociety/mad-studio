import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveRemoveBgSourceUrl } from "./resolve-remove-bg-source.ts"

const REMOTE =
  "https://cdn.example.com/product.jpg"

test("unwraps same-origin image-proxy path", () => {
  const proxy = `/api/media/image-proxy?url=${encodeURIComponent(REMOTE)}&entityId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
  assert.equal(resolveRemoveBgSourceUrl(proxy), REMOTE)
})

test("unwraps absolute image-proxy URL", () => {
  const proxy = `http://localhost:5173/api/media/image-proxy?url=${encodeURIComponent(REMOTE)}&entityId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
  assert.equal(resolveRemoveBgSourceUrl(proxy), REMOTE)
})

test("passes through https URLs", () => {
  assert.equal(resolveRemoveBgSourceUrl(REMOTE), REMOTE)
})
