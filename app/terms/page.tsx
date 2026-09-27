import Link from "next/link"

export const metadata = {
  title: "Terms of Service | MAD STUDIO",
  description: "Terms and conditions for utilizing the MAD STUDIO platform.",
}

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Last Updated: 27 September 2026 • New Zealand
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            1. Acceptance of Terms
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            By accessing or using MAD STUDIO (madstudio.nz), you agree to be
            bound by these Terms of Service. If you are entering into this
            agreement on behalf of a company or legal entity, you represent that
            you possess the authority to bind such entity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            2. Permitted Use &amp; Account Responsibilities
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            You are responsible for maintaining the confidentiality of your
            credentials and access secrets. You agree not to use the platform to
            distribute misleading advertising, unauthorized intellectual
            property, malicious links, or content that violates third-party
            social network terms (including Meta and TikTok platform terms).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            3. Intellectual Property &amp; Brand Ownership
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            All brand assets, photography, logos, and product content uploaded to
            your organization workspace remain your exclusive property. MAD
            STUDIO claims no ownership over user-generated marketing assets,
            product listings, or generated campaign output.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            4. Automated Publishing &amp; Platform API Disclaimers
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            MAD STUDIO facilitates direct and scheduled social publishing via
            official APIs and background dispatch workers. While we maintain
            reliable queueing and error retry mechanisms, we are not liable for
            distribution delays or account actions resulting from third-party
            network outages, rate limits, or API policy enforcement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">
            5. Governing Law
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            These terms are governed by and construed in accordance with the laws
            of New Zealand. Any disputes arising under these terms shall be
            subject to the exclusive jurisdiction of the courts of New Zealand.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">6. Inquiries</h2>
          <p className="text-sm leading-relaxed text-stone-600">
            Direct legal and operational inquiries to:{" "}
            <a
              href="mailto:support@madstudio.nz"
              className="text-stone-800 underline"
            >
              support@madstudio.nz
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
