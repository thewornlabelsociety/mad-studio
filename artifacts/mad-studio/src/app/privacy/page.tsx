import { useEffect } from "react"
import { Link } from "wouter"

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy | MAD STUDIO"
  }, [])

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-16 font-sans text-stone-900 sm:px-12 lg:px-24">
      <div className="mx-auto max-w-3xl space-y-8 rounded-lg border border-stone-200 bg-white p-8 shadow-sm sm:p-12">
        <div className="border-b border-stone-200 pb-6">
          <Link
            href="/"
            className="text-xs tracking-widest text-stone-500 uppercase hover:text-stone-900"
          >
            ← Back to MAD STUDIO
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-950">
            Privacy Policy
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Effective Date: 27 September 2026 • New Zealand
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">1. Overview</h2>
          <p className="text-sm leading-relaxed text-stone-600">
            MAD STUDIO (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;),
            operating via madstudio.nz, provides an autonomous creative workflow,
            multi-channel scheduling, and performance analytics platform. We are
            committed to safeguarding personal and organizational information in
            compliance with the New Zealand Privacy Act 2020.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            2. Information We Collect
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone-600">
            <li>
              <strong>Account Information:</strong> Operator name, business email
              address, and authentication credentials.
            </li>
            <li>
              <strong>Marketing &amp; Media Assets:</strong> Visual assets
              (photographs, Reels, video clips) uploaded for multimodal analysis
              and social distribution.
            </li>
            <li>
              <strong>Social Media Credentials:</strong> OAuth tokens, Page IDs,
              and business account identifiers (e.g., Meta Graph API credentials)
              stored via secure encryption to execute authorized publishing
              actions on your behalf.
            </li>
            <li>
              <strong>Analytical Signals:</strong> Shortlink engagement, click
              counts, IP-derived referral types, and aggregated platform metrics.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            3. How We Use Data
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            We use collected data solely to:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone-600">
            <li>
              Synthesize campaign copy, hooks, and captions grounded in your
              uploaded visual assets.
            </li>
            <li>
              Schedule and dispatch posts directly to authorized social networks
              (Instagram, Facebook, TikTok) and VIP email distribution channels.
            </li>
            <li>
              Log click attribution and campaign performance via our in-house
              redirect engine (<code>/r/[slug]</code>).
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            4. Third-Party Integrations &amp; Subprocessors
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            MAD STUDIO interacts with external service providers strictly to
            perform core application functionality:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone-600">
            <li>
              <strong>Meta Graph API:</strong> For container creation,
              publishing, and social metrics retrieval for connected Facebook
              Pages and Instagram Business accounts.
            </li>
            <li>
              <strong>Supabase:</strong> For relational database persistence,
              Row-Level Security isolation, and secure asset storage.
            </li>
            <li>
              <strong>Google Generative AI (Gemini):</strong> For visual
              inspection and copy drafting. Your media is processed securely and
              is not used to train global public models.
            </li>
          </ul>
        </section>

        <section id="data-deletion" className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            5. Data Retention &amp; Deletion Instructions
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            Users may revoke platform integrations or request complete deletion
            of their account, uploaded media, and stored tokens at any time. To
            request data deletion, contact us at{" "}
            <a
              href="mailto:privacy@madstudio.nz"
              className="text-stone-800 underline"
            >
              privacy@madstudio.nz
            </a>{" "}
            or visit our automated callback endpoint at{" "}
            <a
              href="/api/auth/data-deletion"
              className="text-stone-800 underline"
            >
              /api/auth/data-deletion
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            6. Contact Information
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            For questions regarding this policy or our data practices:
            <br />
            <strong>MAD STUDIO Privacy Officer</strong>
            <br />
            Whangārei, Northland, New Zealand
            <br />
            Email:{" "}
            <a
              href="mailto:privacy@madstudio.nz"
              className="text-stone-800 underline"
            >
              privacy@madstudio.nz
            </a>
          </p>
        </section>
      </div>
    </main>
  )
}
