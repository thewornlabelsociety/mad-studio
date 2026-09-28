"use client"

import { useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { Loader2, MessageSquare, Pin, Sparkles, Wand2 } from "lucide-react"
import { useRouter } from "@/lib/next-compat"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { brandDirectorChips } from "@/lib/brain/brain-industry-ui"

type BrainChatProps = {
  entityId: string
  entityName: string
  industry: string
}

function messagePlainText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("")
    .trim()
}

async function parseChatErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        error?: string
        detail?: unknown
        code?: string
      }
      if (payload.error) {
        if (payload.code) {
          return `${payload.error} (${payload.code})`
        }
        return payload.error
      }
    } catch {
      // fall through
    }
  }
  return `Chat request failed (${response.status}).`
}

export function BrainChat({
  entityId,
  entityName,
  industry,
}: BrainChatProps) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [transportError, setTransportError] = useState<string | null>(null)

  const suggestionChips = useMemo(
    () => brandDirectorChips(industry, entityName),
    [industry, entityName]
  )

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/brain/chat",
        body: { entityId },
        fetch: async (url, init) => {
          setTransportError(null)
          const response = await fetch(url, init)
          if (!response.ok) {
            const message = await parseChatErrorResponse(response)
            setTransportError(message)
            throw new Error(message)
          }
          return response
        },
      }),
    [entityId]
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    id: `brain-director-${entityId}`,
    transport,
    onError: (err) => {
      setTransportError(err.message)
    },
  })

  const displayError = transportError ?? error?.message ?? null
  const isBusy = status === "submitted" || status === "streaming"

  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setTransportError(null)
    setInput("")
    await sendMessage({ text: trimmed })
  }

  async function saveToMemory(message: UIMessage) {
    const text = messagePlainText(message)
    if (!text) {
      toast.error("Nothing to save yet.")
      return
    }
    setSavingId(message.id)
    try {
      const res = await fetch("/api/brain/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          text,
          title: `Brand Director · ${entityName}`,
        }),
      })
      const payload = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !payload.ok) {
        toast.error(payload.error ?? "Could not save to Memory Vault.")
        return
      }
      toast.success("📌 Saved to Memory Vault")
      router.refresh()
    } catch {
      toast.error("Could not reach Memory Vault.")
    } finally {
      setSavingId(null)
    }
  }

  function sendToStudio(message: UIMessage) {
    const text = messagePlainText(message)
    if (!text) {
      toast.error("Nothing to send yet.")
      return
    }
    try {
      sessionStorage.setItem(
        `studio-prompt:${entityId}`,
        text.slice(0, 4000)
      )
    } catch {
      // sessionStorage may be unavailable — still navigate
    }
    const params = new URLSearchParams({
      eid: entityId,
      prompt: text.slice(0, 500),
    })
    toast.success("⚡ Opening Studio with this angle")
    router.push(`/studio?${params.toString()}`)
  }

  return (
    <div className="flex min-h-[28rem] flex-col border-2 border-mad-black bg-mad-white shadow-keycap-sm">
      <header className="border-b-2 border-mad-black px-4 py-3 sm:px-5">
        <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Brand Director Chat
        </p>
        <h2 className="mt-1 font-typewriter text-base text-mad-black sm:text-lg">
          Talk to {entityName}&apos;s Brain
        </h2>
        <p className="mt-1 text-xs text-neutral-600">
          Brainstorm angles in the brand&apos;s own voice — then pin winners or
          ship them straight to Studio.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b-2 border-mad-black px-4 py-3 sm:px-5">
        {suggestionChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={isBusy}
            onClick={() => void handleSend(chip.prompt)}
            className="rounded-none border-2 border-mad-black bg-mad-white px-3 py-2 text-left font-typewriter text-[0.65rem] leading-snug tracking-wide text-mad-black uppercase transition-colors hover:bg-mad-black hover:text-mad-white disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-neutral-500">
            <MessageSquare className="size-6 opacity-50" />
            <p className="font-typewriter text-xs tracking-widest uppercase">
              Ask the Brand Director anything
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const text = messagePlainText(message)
            const isAssistant = message.role === "assistant"
            return (
              <article
                key={message.id}
                className={`max-w-[95%] space-y-2 sm:max-w-[85%] ${
                  isAssistant ? "mr-auto" : "ml-auto"
                }`}
              >
                <p className="font-typewriter text-[0.6rem] tracking-widest text-neutral-500 uppercase">
                  {isAssistant ? "Brand Director" : "You"}
                </p>
                <div
                  className={`whitespace-pre-wrap border-2 border-mad-black px-3 py-2.5 text-sm leading-relaxed ${
                    isAssistant
                      ? "bg-mad-white text-mad-black"
                      : "bg-mad-black text-mad-white"
                  }`}
                >
                  {text || (isBusy && isAssistant ? "…" : "")}
                </div>
                {isAssistant && text ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingId === message.id}
                      onClick={() => void saveToMemory(message)}
                      className="h-8 rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] tracking-widest uppercase"
                    >
                      {savingId === message.id ? (
                        <Loader2
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <Pin data-icon="inline-start" />
                      )}
                      Save to Memory Vault
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => sendToStudio(message)}
                      className="h-8 rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] tracking-widest uppercase"
                    >
                      <Wand2 data-icon="inline-start" />
                      Send to Studio
                    </Button>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
        {displayError ? (
          <p className="border-2 border-mad-vermillion px-3 py-2 text-sm text-mad-vermillion">
            {displayError}
          </p>
        ) : null}
      </div>

      <form
        className="flex flex-col gap-2 border-t-2 border-mad-black p-4 sm:flex-row sm:items-end sm:px-5"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSend(input)
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void handleSend(input)
            }
          }}
          disabled={isBusy}
          rows={2}
          placeholder="Ask for angles, hooks, critiques, pitches…"
          className="min-h-[4.5rem] flex-1 resize-none rounded-none border-2 border-mad-black font-typewriter text-sm shadow-none"
        />
        <div className="flex shrink-0 gap-2">
          {isBusy ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => stop()}
              className="h-11 rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] tracking-widest uppercase"
            >
              Stop
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="h-11 rounded-none border-2 border-mad-black bg-mad-black px-5 font-typewriter text-[0.7rem] tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion"
          >
            {isBusy ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Thinking…
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                Send
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
