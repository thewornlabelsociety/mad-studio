---
name: Replit preview auth cookies
description: Why Supabase browser auth uses partitioned cookies in Replit's embedded development preview.
---

For HTTPS `.replit.dev` previews, Supabase browser auth cookies need `SameSite=None`, `Secure`, and `Partitioned` so a session can persist inside Replit's embedded preview. Keep this relaxation limited to that preview host; production should retain the normal same-site cookie policy.

**Why:** The embedded preview can treat the app origin as a third-party frame. Default `SameSite=Lax` cookies may not persist there, which can make a successful sign-in appear to bounce back to login.

**How to apply:** Preserve the host-and-HTTPS guard when changing Supabase browser auth. If the preview host changes, reassess the cookie policy rather than enabling cross-site cookies globally.