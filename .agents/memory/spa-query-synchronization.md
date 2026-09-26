---
name: SPA query synchronization
description: Why URL updates during saved-state restoration must stay within the current page.
---

When a client page restores saved state and mirrors it into URL query parameters, make the URL update idempotent and in-place. Reserve a full navigation for actual page changes.

**Why:** The Next-style navigation compatibility layer in this Vite port can perform a full document reload. Repeating that during saved-draft restoration restarts the same restoration on every mount and causes a visible reload loop.

**How to apply:** For query-only state synchronization, compare the desired URL with the current one and use History replacement rather than a full-page router replacement.