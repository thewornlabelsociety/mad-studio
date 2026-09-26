import { redirect } from "@/lib/next-compat"

import { acceptInvitation } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"

type InvitePageProps = {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const { entityId, error } = await acceptInvitation(token)

  if (error === "unauthenticated") {
    redirect(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="brand-typewriter text-[0.65rem] text-mad-black">
          MAD STUDIO
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invitation unavailable
        </h1>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    )
  }

  if (entityId) {
    redirect(`/studio?eid=${encodeURIComponent(entityId)}`)
  }

  redirect("/studio")
}
