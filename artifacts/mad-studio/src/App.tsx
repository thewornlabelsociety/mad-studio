import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, Route, Switch, Router as WouterRouter, useLocation } from "wouter"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { PageLoader } from "@/lib/page-loader"
import { MadStudioLogo } from "@/components/brand/mad-logo"
import StudioPage from "@/app/studio/page"
import TodayPage from "@/app/today/page"
import InventoryPage from "@/app/inventory/page"
import InventoryItemPage from "@/app/inventory/[id]/page"
import BrainPage from "@/app/brain/page"
import CampaignsPage from "@/app/campaigns/page"
import AnalyticsPage from "@/app/analytics/page"
import SocialSettingsPage from "@/app/settings/social/page"
import NewEntityPage from "@/app/entities/new/page"
import InvitePage from "@/app/invite/[token]/page"
import PrivacyPolicyPage from "@/app/privacy/page"
import TermsOfServicePage from "@/app/terms/page"
import { AuthForm } from "@/components/auth/auth-form"
import { createClient } from "@/lib/supabase/client"
import type { EmailOtpType } from "@supabase/supabase-js"

const client = new QueryClient()
function query() { return Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search))) }
function Content({ children }: { children: ReactNode }) {
  const [path] = useLocation()
  return <ErrorBoundary resetKey={path}>{children}</ErrorBoundary>
}
function Home() {
  return <PageLoader load={async () => {
    let signedIn = false
    try { signedIn = !!(await createClient().auth.getSession()).data.session } catch { /* Public page remains available without configuration. */ }
    const href = signedIn ? "/studio" : "/login"
    return (
      <div className="flex min-h-svh flex-1 flex-col bg-mad-white">
        <header className="border-b-2 border-mad-black"><div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <MadStudioLogo size="md" />
          <div className="flex items-center gap-3 sm:gap-4"><a href={href} className="hidden font-typewriter text-xs font-bold tracking-wider text-mad-black uppercase sm:inline hover:text-mad-vermillion">Sign In</a>
            <a href={href} className="border-2 border-mad-black bg-mad-black px-4 py-2.5 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase transition-colors hover:bg-neutral-800">Enter Studio →</a></div>
        </div></header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-14 pb-20 sm:pt-20">
          <section className="flex max-w-4xl flex-col gap-6"><h1 className="brand-typewriter max-w-4xl text-3xl leading-[1.15] text-mad-black sm:text-5xl lg:text-6xl">The AI sidekick your creative director actually wants to work with</h1>
            <p className="max-w-2xl pt-2 text-base leading-relaxed font-normal text-neutral-600 sm:text-xl">Turn today&apos;s shop drop, menu special, or customer win into ready-to-shoot video scripts, carousels, and search-indexed captions in 10 seconds flat.</p>
            <div className="flex flex-wrap gap-3 pt-2"><a href={href} className="border-2 border-mad-black bg-mad-black px-7 py-3.5 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase shadow-keycap transition-all hover:-translate-x-px hover:-translate-y-px">Launch Studio Workspace →</a>
              <a href={href} className="border-2 border-mad-black bg-mad-white px-7 py-3.5 font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase transition-all hover:bg-neutral-50">Sign In</a></div>
          </section>
        </main>
        <footer className="border-t-2 border-mad-black"><div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <p className="font-typewriter text-[0.65rem] tracking-wider text-neutral-500 uppercase">© {new Date().getFullYear()} MAD STUDIO · Whangārei, New Zealand</p>
          <nav className="flex items-center gap-5" aria-label="Legal">
            <Link href="/privacy" className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase hover:text-mad-vermillion">Privacy Policy</Link>
            <Link href="/terms" className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase hover:text-mad-vermillion">Terms of Service</Link>
          </nav>
        </div></footer>
      </div>
    )
  }} />
}
function Login() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get("token")
  const redirect = params.get("redirect")
  const destination = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : token && /^[a-zA-Z0-9_-]+$/.test(token) ? `/invite/${token}` : "/studio"
  return <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-mad-white px-4 py-16">
    <AuthForm redirectTo={destination} inviteToken={token} initialMode={params.get("mode") === "signup" ? "signup" : "signin"} initialError={params.get("error") ?? undefined} initialMessage={params.get("message") ?? undefined} />
  </div>
}
function AuthCallback() {
  return <PageLoader load={async () => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/studio"
    const code = params.get("code")
    const tokenHash = params.get("token_hash")
    const type = params.get("type") as EmailOtpType | null
    const error = code
      ? (await createClient().auth.exchangeCodeForSession(code)).error
      : tokenHash && type
        ? (await createClient().auth.verifyOtp({ token_hash: tokenHash, type })).error
        : new Error("Confirmation link is missing its code.")
    window.location.replace(error ? `/login?error=${encodeURIComponent(error.message)}&redirect=${encodeURIComponent(destination)}` : destination)
    return null
  }} />
}
function App() {
  return <QueryClientProvider client={client}><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Content><Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/auth/confirm" component={AuthCallback} />
        <Route path="/privacy" component={PrivacyPolicyPage} />
        <Route path="/terms" component={TermsOfServicePage} />
        <Route path="/studio">{() => <PageLoader load={() => StudioPage({ searchParams: query() })} />}</Route>
        <Route path="/today">{() => <PageLoader load={() => TodayPage({ searchParams: query() })} />}</Route>
        <Route path="/inventory">{() => <PageLoader load={async () => { await InventoryPage({ searchParams: query() }); return null }} />}</Route>
        <Route path="/inventory/:id">{(params) => <PageLoader load={async () => { await InventoryItemPage({ params: Promise.resolve(params), searchParams: query() }); return null }} />}</Route>
        <Route path="/brain">{() => <PageLoader load={() => BrainPage({ searchParams: query() })} />}</Route>
        <Route path="/campaigns">{() => <PageLoader load={() => CampaignsPage({ searchParams: query() })} />}</Route>
        <Route path="/analytics">{() => <PageLoader load={() => AnalyticsPage({ searchParams: query() })} />}</Route>
        <Route path="/settings/social">{() => <PageLoader load={() => SocialSettingsPage({ searchParams: query() })} />}</Route>
        <Route path="/entities/new">{() => <PageLoader load={() => NewEntityPage()} />}</Route>
        <Route path="/invite/:token">{(params) => <PageLoader load={() => InvitePage({ params: Promise.resolve(params) })} />}</Route>
        <Route><div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-mad-white"><MadStudioLogo size="md" /><h1 className="brand-typewriter text-xl">Page not found</h1><a href="/" className="border-2 border-mad-black px-5 py-3 font-typewriter text-xs uppercase">Return home</a></div></Route>
      </Switch></Content>
    </WouterRouter>
    <Toaster richColors closeButton position="top-center" />
  </ThemeProvider></QueryClientProvider>
}
export default App;