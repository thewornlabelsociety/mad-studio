import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "wouter"

type State = { node: ReactNode; error: string | null; loading: boolean }

function currentRouteKey(): string {
  return `${window.location.pathname}${window.location.search}`
}

export function PageLoader({ load }: { load: () => Promise<ReactNode> }) {
  const [pathname] = useLocation()
  const [routeKey, setRouteKey] = useState(currentRouteKey)
  const [state, setState] = useState<State>({ node: null, error: null, loading: true })
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    setRouteKey(currentRouteKey())
  }, [pathname])

  useEffect(() => {
    const bump = () => setRouteKey(currentRouteKey())
    window.addEventListener("popstate", bump)
    window.addEventListener("mad:refresh", bump)
    // replaceState is deliberately not patched: pages use it to quietly record
    // state in the URL (e.g. Studio's eid/pack_id), and reloading on it would
    // remount the page and loop. Real path changes still reload via `pathname`.
    const pushState = history.pushState.bind(history)
    history.pushState = (...args) => {
      pushState(...args)
      bump()
    }
    return () => {
      window.removeEventListener("popstate", bump)
      window.removeEventListener("mad:refresh", bump)
      history.pushState = pushState
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let latestRun = 0
    const run = async () => {
      const thisRun = ++latestRun
      setState({ node: null, error: null, loading: true })
      try {
        const node = await loadRef.current()
        if (mounted && thisRun === latestRun) {
          setState({ node, error: null, loading: false })
        }
      } catch (error) {
        if (mounted && thisRun === latestRun && (error as Error).message !== "MAD_REDIRECT") {
          setState({ node: null, error: error instanceof Error ? error.message : "Could not load the workspace.", loading: false })
        }
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [routeKey])
  if (state.loading) return (
    <div className="flex min-h-svh flex-col bg-mad-white p-6">
      <div className="h-12 w-full animate-pulse bg-neutral-100" />
      <div className="mx-auto mt-12 h-8 w-full max-w-6xl animate-pulse bg-neutral-100" />
      <div className="mx-auto mt-5 h-64 w-full max-w-6xl animate-pulse bg-neutral-100" />
    </div>
  )
  if (state.error) return (
    <div className="flex min-h-svh items-center justify-center bg-mad-white p-6">
      <div className="max-w-lg border-2 border-mad-black p-7 shadow-keycap">
        <p className="brand-typewriter text-xs text-mad-vermillion">MAD STUDIO / CONFIGURATION</p>
        <h1 className="mt-4 font-typewriter text-xl font-bold uppercase">Workspace unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{state.error}</p>
        <button type="button" className="mt-5 border-2 border-mad-black bg-mad-lime px-5 py-2 font-typewriter text-xs font-bold uppercase" onClick={() => window.dispatchEvent(new Event("mad:refresh"))}>Retry</button>
      </div>
    </div>
  )
  return <>{state.node}</>
}