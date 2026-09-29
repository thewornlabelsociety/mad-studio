"use client"

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
      className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm transition-colors hover:bg-mad-black hover:text-mad-white"
    >
      [ ◀ BACK TO WORKSPACE ]
    </button>
  )
}
