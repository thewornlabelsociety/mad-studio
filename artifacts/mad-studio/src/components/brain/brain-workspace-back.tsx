"use client"

import { ArrowLeft } from "lucide-react"

import { useRouter } from "@/lib/next-compat"

type BrainWorkspaceBackProps = {
  entityId: string
}

export function BrainWorkspaceBack({ entityId }: BrainWorkspaceBackProps) {
  const router = useRouter()

  function onBack() {
    const studio = `/studio?eid=${encodeURIComponent(entityId)}`
    if (typeof window !== "undefined" && window.history.length > 1) {
      const ref = document.referrer
      if (ref.includes("/today")) {
        router.push(`/today?eid=${encodeURIComponent(entityId)}`)
        return
      }
    }
    router.push(studio)
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm transition-colors hover:bg-mad-black hover:text-mad-white"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back to workspace
    </button>
  )
}
