import { useEffect, useRef, useState, type ReactNode } from "react"

type State = { node: ReactNode; error: string | null; loading: boolean }

export function PageLoader({ load }: { load: () => Promise<ReactNode> }) {
  const [state, setState] = useState<State>({ node: null, error: null, loading: true })
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let mounted = true
    const run = () => {
      setState((current) => ({ ...current, loading: true }))
      loadRef.current().then((node) => {
        if (mounted) setState({ node, error: null, loading: false })
      }).catch((error: unknown) => {
        if (mounted && (error as Error).message !== "MAD_REDIRECT") {
          setState({ node: null, error: error instanceof Error ? error.message : "Could not load the workspace.", loading: false })
        }
      })
    }
    run()
    window.addEventListener("mad:refresh", run)
    return () => { mounted = false; window.removeEventListener("mad:refresh", run) }
  }, [])
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