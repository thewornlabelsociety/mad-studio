---
name: SPA route loading
description: Prevent stale pages when the Next-to-Vite port navigates without a full document load.
---

Page loading must react to pathname changes made by client-side navigation, even when React reuses the same loader component for adjacent routes.

**Why:** The app has asynchronous page functions that return rendered content. A mount-only loader can retain the previous page after menu links update the URL, leaving users apparently stuck on that page.

**How to apply:** Keep asynchronous loaders bound to the current route, and ignore results from earlier route or refresh requests so late responses cannot overwrite the new screen.