# MAD STUDIO

MAD STUDIO is a multi-brand marketing workspace for inventory, content generation, campaigns, publishing, and analytics.

## Run & verify

- **Preview needs two processes:** UI (port **24726**) and API (port **8080**). `/api/*` and server actions fail with **502** if only the UI is running.
- If your Repl has a **Workflows** panel, start `artifacts/mad-studio: web` and `artifacts/api-server: API Server`.
- If you **do not** see Workflows, use **Shell** after `git pull`:

  ```bash
  bash scripts/replit-dev.sh
  ```

  Or two tabs: (1) `PORT=8080 pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start` (2) `PORT=24726 BASE_PATH=/ pnpm --filter @workspace/mad-studio run dev`.

- **Publishing / Deploy** uses production builds from each artifact’s `.replit-artifact/artifact.toml`; that is separate from the dev preview Shell flow above.
- `pnpm --filter @workspace/mad-studio run typecheck` and `pnpm --filter @workspace/api-server run typecheck` check the applications.
- `pnpm --filter @workspace/api-spec run codegen` regenerates the shared API types.

## Architecture

- `artifacts/mad-studio` is the Vite/React port of the imported Next.js UI. The original visual theme is in `src/index.css`; all user-facing pages live under `src/app`.
- `artifacts/api-server/src/ported` contains the imported server actions, API routes, and server libraries. Express adapters in `src/routes` serve the original `/api/*` endpoints and an action RPC at `/api/actions/:name`. The action contract is documented in `artifacts/api-server/PORTING.md`.
- Authentication, data, and storage remain on the **existing external Supabase project**. The scaffold's `lib/db` package is unused by this app; do not migrate its data to Replit PostgreSQL without explicit authorization.
- Public links use the configured Replit/custom app origin; never derive public or secret-bearing server-to-server targets from request `Host` headers. Remote media must be fetched through the pinned-address, redirect-checked image fetch helper.
- Imported Supabase migration SQL is preserved in `supabase/migrations`. Do not automatically run it against the external project. The app expects the external schema to match those migrations.
- Imported public Supabase settings are exposed to the browser through the Vite config; the service-role key and provider credentials are server-side only. Never log their values.

## Known operational gaps

- The external Supabase `record_link_click` routine currently fails with a missing `link_clicks.last_clicked_at` column; this is an external schema mismatch, not a route/proxy error. Confirm the intended external migration state before changing that database.
- The imported Vercel cron definitions in `.migration-backup/vercel.json` do not automatically schedule jobs on Replit. The API endpoints are ported, but scheduling requires an explicit operational setup.