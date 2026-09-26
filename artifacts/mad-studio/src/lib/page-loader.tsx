import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "wouter"

type State = { node: ReactNode; error: string | null; loading: boolean }

export function PageLoader({ load }: { load: () => Promise<ReactNode> }) {
  const [pathname] = useLocation()
  const [state, setState] = useState<State>({ node: null, error: null, loading: true })
  const loadRef = useRef(load)
  loadRef.current = load
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
    const onRefresh = () => { void run() }
    onRefresh()
    window.addEventListener("mad:refresh", onRefresh)
    return () => { mounted = false; window.removeEventListener("mad:refresh", onRefresh) }
  }, [pathname])
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
        <p className="mt-3 text-sm">{state.error}</p>
        <button type="button" className="mt-5 border-2 border-mad-black bg-mad-lime px-5 py-2 font-typewriter text-xs font-bold uppercase" onClick={() => window.dispatchEvent(new Event("mad:refresh"))}>Retry</button>
      </div>
    </div>
  )
  return <>{state.node}</>
}