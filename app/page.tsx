import Link from "next/link"

import { MadStudioLogo } from "@/components/brand/mad-logo"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const primaryHref = user ? "/studio" : "/login"
  const signInHref = user ? "/studio" : "/login"

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-mad-white">
      <header className="border-b-2 border-mad-black">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <MadStudioLogo size="md" />
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href={signInHref}
              className="hidden font-typewriter text-xs font-bold tracking-wider text-mad-black uppercase sm:inline hover:text-mad-vermillion"
            >
              Sign In
            </Link>
            <Link
              href={primaryHref}
              className="border-2 border-mad-black bg-mad-black px-4 py-2.5 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase transition-colors hover:bg-neutral-800"
            >
              Enter Studio →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-14 pb-20 sm:pt-20">
        <section className="flex max-w-4xl flex-col gap-6">
          <h1 className="brand-typewriter max-w-4xl text-3xl leading-[1.15] text-mad-black sm:text-5xl lg:text-6xl">
            The AI sidekick your creative director actually wants to work with
          </h1>

          <p className="max-w-2xl pt-2 text-base leading-relaxed font-normal text-neutral-600 sm:text-xl">
            Turn today&apos;s shop drop, menu special, or customer win into
            ready-to-shoot video scripts, carousels, and search-indexed captions
            in 10 seconds flat.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={primaryHref}
              className="border-2 border-mad-black bg-mad-black px-7 py-3.5 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase shadow-keycap transition-all hover:-translate-x-px hover:-translate-y-px"
            >
              Launch Studio Workspace →
            </Link>
            <Link
              href={signInHref}
              className="border-2 border-mad-black bg-mad-white px-7 py-3.5 font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase transition-all hover:bg-neutral-50"
            >
              Sign In
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-mad-black">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <p className="font-typewriter text-[0.65rem] tracking-wider text-neutral-500 uppercase">
            © {new Date().getFullYear()} MAD STUDIO · Whangārei, New Zealand
          </p>
          <nav className="flex items-center gap-5" aria-label="Legal">
            <Link
              href="/privacy"
              className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase hover:text-mad-vermillion"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase hover:text-mad-vermillion"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
