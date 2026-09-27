import { createHmac, randomBytes, timingSafeEqual } from "crypto"

import { HttpResponse } from "@server/http-response"

import { siteOrigin } from "@/lib/social/types"

export const runtime = "nodejs"

const CONTACT_EMAIL = "privacy@madstudio.nz"

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

/** Verifies Meta's `signed_request` (HMAC-SHA256 with the app secret). */
function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): { user_id?: string } | null {
  const [encodedSig, payload] = signedRequest.split(".", 2)
  if (!encodedSig || !payload) return null
  const expected = createHmac("sha256", appSecret).update(payload).digest()
  const provided = base64UrlDecode(encodedSig)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null
  }
  try {
    return JSON.parse(base64UrlDecode(payload).toString("utf8")) as {
      user_id?: string
    }
  } catch {
    return null
  }
}

/**
 * Meta Data Deletion Callback. Meta POSTs `signed_request`; we acknowledge
 * with a status URL + confirmation code, then the deletion is actioned by
 * the privacy officer.
 */
export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appSecret) {
    return HttpResponse.json(
      { error: "Data deletion callback is not configured." },
      { status: 500 }
    )
  }

  // The Express adapter re-serialises urlencoded bodies as JSON but keeps the
  // original content-type, so accept either shape.
  const text = await request.text().catch(() => "")
  let signedRequest: string | null = null
  try {
    const body = JSON.parse(text) as { signed_request?: unknown }
    signedRequest =
      typeof body.signed_request === "string" ? body.signed_request : null
  } catch {
    signedRequest = new URLSearchParams(text).get("signed_request")
  }

  if (!signedRequest) {
    return HttpResponse.json(
      { error: "signed_request is required." },
      { status: 400 }
    )
  }

  const data = parseSignedRequest(signedRequest, appSecret)
  if (!data?.user_id) {
    return HttpResponse.json({ error: "Invalid signed_request." }, { status: 400 })
  }

  const confirmationCode = randomBytes(8).toString("hex")
  console.info("[data-deletion] Meta deletion request", {
    userId: data.user_id,
    confirmationCode,
  })

  return HttpResponse.json({
    url: `${siteOrigin()}/api/auth/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}

/** Human-readable instructions / status lookup for the callback URL. */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")
  return HttpResponse.json({
    service: "MAD STUDIO data deletion",
    ...(code
      ? {
          confirmation_code: code,
          status:
            "Received. Your connected tokens, uploaded media, and account data will be deleted within 30 days.",
        }
      : {
          instructions: [
            "Disconnect MAD STUDIO in your Facebook / Instagram settings (Apps and Websites) to trigger an automatic deletion request, or",
            `email ${CONTACT_EMAIL} from your account email to request deletion of your account, uploaded media, and stored tokens.`,
          ],
        }),
    contact: CONTACT_EMAIL,
    policy: `${siteOrigin()}/privacy#data-deletion`,
  })
}
