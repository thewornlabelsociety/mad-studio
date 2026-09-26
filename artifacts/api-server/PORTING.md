# Express server port

The imported server behavior is served by this Express artifact while continuing
to use the imported Supabase project for authentication, storage, RPCs, and
database access. No Replit database is used, and startup does not create or seed
any records.

## Routes

The existing route handlers are retained under `src/ported` and invoked through
Express adapters. API routes remain under `/api`; the non-API Next routes are
registered at `/auth/callback`, `/auth/confirm`, and `/r/:slug`. Because the
API artifact's service base path is `/api`, browser-facing auth callbacks and
short links are also exposed at `/api/auth/callback`, `/api/auth/confirm`, and
`/api/r/:slug`. Generated Supabase callback and trackable links use these
routable `/api/...` URLs.

## Frontend server-action RPC

POST `/api/actions/:name` with JSON:

```json
{ "args": [ { "entityId": "..." } ] }
```

`args` is a positional array in the original exported function's argument
order. Object arguments are passed as one object at the corresponding position;
for example, `createEntity` is `{ "args": [{ "name": "...", "organizationId": "...", "dna": {} }] }`.
Zero-argument functions use `{ "args": [] }`. An `arguments` array is accepted
as an alias. Action functions retain their imported validation and authorization
checks. Successful results are returned as `{ "result": ... }`; redirects
thrown by the imported action code are returned as `{ "redirect": "..." }`.
Unknown names return 404; malformed RPC envelopes return 400.
Send the user's normal Supabase session cookies with the request.

`signInWithPassword`, `signUpWithPassword`, and `uploadEntityDocument` take a
FormData argument. For the JSON RPC transport, represent its first argument as
a field-name/value object; scalar fields may be strings, numbers, or booleans.
For file fields, use `{ "name": "file.jpg", "type": "image/jpeg", "base64":
"..." }`. For example:

```json
{
  "args": [{
    "entity_id": "uuid",
    "file": {
      "name": "brief.pdf",
      "type": "application/pdf",
      "base64": "JVBERi0..."
    }
  }]
}
```

The RPC action names and original argument order are:

| Name | Arguments |
| --- | --- |
| `signInWithPassword` | `formData` |
| `signUpWithPassword` | `formData` |
| `signOut` | none |
| `setActiveEntity` | `entityId`, `options?` |
| `createInvitation` | `input` |
| `acceptInvitation` | `token` |
| `getAccessibleEntities` | `userId` |
| `getActiveOrganizationId` | `userId` |
| `isCurrentUserOrgAdmin` | `organizationId` |
| `claimFirstOrgAdmin` | none |
| `saveEntityDna` | `input` |
| `saveVisualPresets` | `input` |
| `commitScrapedDna` | `input` |
| `resyncDnaFromWebsite` | `entityId` |
| `uploadEntityDocument` | `formData` |
| `deleteEntityDocument` | `input` |
| `addCustomerQuote` | `input` |
| `deleteCustomerQuote` | `input` |
| `updateCampaignTakeaway` | `input` |
| `clearCampaignTakeaway` | `input` |
| `validateDnaShape` | `dna` |
| `getStudioPack` | `input` |
| `getLatestStudioDraft` | `input` |
| `saveCampaign` | `input` |
| `dispatchCampaignPack` | `input` |
| `createEntity` | `input` |
| `appendInventoryImage` | `input` |
| `removeInventoryImage` | `input` |
| `approveMarketingEntity` | `input` |
| `scheduleMarketingEntity` | `input` |
| `saveDropDraft` | `input` |
| `armMultiChannelDispatch` | `input` |
| `repurposeMarketingEntity` | `input` |
| `armCampaignMultiChannelDispatch` | `input` |
| `disarmCampaignQueue` | `input` |
| `listSocialConnections` | `input` |
| `upsertSocialConnection` | `input` |
| `deactivateSocialConnection` | `input` |
| `getOutboundWebhook` | `input` |
| `upsertOutboundWebhook` | `input` |
| `testOutboundWebhook` | `input` |
| `ensureInventoryTrackableLink` | `input` |

## Required environment

The server intentionally fails with explicit errors when configuration is
missing. Authenticated Supabase requests require
`NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Admin jobs, short links, and service-role
operations additionally require `SUPABASE_SERVICE_ROLE_KEY`. AI, social
publishing, cron, website-sync, and inventory operations also require their
respective provider credentials/secrets (such as `GOOGLE_GENERATIVE_AI_API_KEY`,
`META_ACCESS_TOKEN`, `CRON_SECRET`, and `SYNC_WEBHOOK_SECRET`).

No credential values are placed in source. With credentials absent, affected
operations fail explicitly; no mock/demo credentials or data are substituted.
The imported inventory sample-feed fallback is disabled in this server port;
without a configured real feed, inventory sync returns its source error instead
of creating sample items.

## Port notes

The server uses a per-request cookie context to preserve Supabase SSR refresh
cookies and action cookie behavior. `revalidatePath` is a no-op because this
Express server has no Next page cache. The app's client must apply redirect
results returned from action RPCs. Binary uploads are supported in RPC file
objects using base64 as documented above.