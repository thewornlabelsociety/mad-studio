"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/lib/next-compat"
import { Loader2, PlugZap, Zap } from "lucide-react"
import { toast } from "sonner"

import {
  testOutboundWebhook,
  upsertOutboundWebhook,
} from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  entityId: string
  brandName: string
  initialWebhookUrl?: string | null
}

export function OutboundWebhookCard({
  entityId,
  brandName,
  initialWebhookUrl = null,
}: Props) {
  const router = useRouter()
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "")
  const [pending, startTransition] = useTransition()
  const [testing, setTesting] = useState(false)

  function onSave() {
    startTransition(async () => {
      const result = await upsertOutboundWebhook({
        entityId,
        webhookUrl,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Outbound webhook saved.")
      router.refresh()
    })
  }

  async function onTestPing() {
    setTesting(true)
    try {
      if (webhookUrl.trim() && webhookUrl.trim() !== (initialWebhookUrl ?? "")) {
        const saved = await upsertOutboundWebhook({ entityId, webhookUrl })
        if (!saved.ok) {
          toast.error(saved.error)
          return
        }
      }
      const result = await testOutboundWebhook({ entityId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Test ping sent to Make / n8n / Zapier.")
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Automation
          </p>
          <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            Outbound Webhook URL
          </h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-600">
            Route TikTok and VIP Email dispatches for {brandName} through
            Make.com, n8n, or Zapier when Meta/Resend are not the path.
          </p>
        </div>
        <PlugZap className="size-5 text-mad-black" />
      </div>

      <div className="mt-4 space-y-2">
        <Label
          htmlFor="outbound-webhook"
          className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase"
        >
          Make.com / n8n / Zapier
        </Label>
        <Input
          id="outbound-webhook"
          value={webhookUrl}
          onChange={(event) => setWebhookUrl(event.target.value)}
          placeholder="https://hook.make.com/…"
          className="rounded-none border-2 border-mad-black font-mono text-sm shadow-keycap-sm"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] font-bold tracking-wider uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save webhook
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onTestPing()}
          disabled={testing || pending}
          className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] font-bold tracking-wider uppercase shadow-keycap-sm"
        >
          {testing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Zap className="size-3.5" />
          )}
          Send Test Ping
        </Button>
      </div>
    </section>
  )
}
