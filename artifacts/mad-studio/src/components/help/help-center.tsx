"use client"

import { useMemo, useState } from "react"
import { Link } from "wouter"

import {
  MAD_STUDIO_HELP_INTRO,
  MAD_STUDIO_HELP_SECTIONS,
  type HelpSection,
} from "@/lib/help/mad-studio-help"
type Props = {
  entityQuery: string
}

function SectionBlock({
  section,
  entityQuery,
}: {
  section: HelpSection
  entityQuery: string
}) {
  return (
    <section
      id={section.id}
      className="scroll-mt-24 border-b-2 border-mad-black/10 pb-10 last:border-b-0"
    >
      <h2 className="font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
        {section.title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700">
        {section.summary}
      </p>
      {section.route ? (
        <p className="mt-2">
          <Link
            href={`${section.route}${entityQuery}`}
            className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-vermillion uppercase hover:underline"
          >
            Open {section.route} →
          </Link>
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {section.features.map((feature) => (
          <li
            key={feature.name}
            className="border-l-2 border-mad-lime pl-3 text-sm"
          >
            <span className="font-semibold text-mad-black">{feature.name}</span>
            <span className="text-neutral-700"> — {feature.description}</span>
          </li>
        ))}
      </ul>

      {section.sop ? (
        <div className="mt-6 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
            SOP · {section.sop.title}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Audience: {section.sop.audience}
          </p>
          {section.sop.prerequisites?.length ? (
            <p className="mt-2 text-xs text-neutral-600">
              Prerequisites: {section.sop.prerequisites.join("; ")}
            </p>
          ) : null}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-800">
            {section.sop.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {section.sop.tips?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-600">
              {section.sop.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function HelpCenter({ entityQuery }: Props) {
  const [filter, setFilter] = useState("")
  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return MAD_STUDIO_HELP_SECTIONS
    return MAD_STUDIO_HELP_SECTIONS.filter(
      (section) =>
        section.title.toLowerCase().includes(q) ||
        section.summary.toLowerCase().includes(q) ||
        section.features.some(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q)
        )
    )
  }, [filter])

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-28 lg:w-56 lg:shrink-0">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
          Contents
        </p>
        <nav className="mt-2 flex flex-col gap-1">
          {MAD_STUDIO_HELP_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="font-typewriter text-[0.65rem] tracking-tight text-mad-black uppercase hover:text-mad-vermillion"
            >
              {section.title}
            </a>
          ))}
        </nav>
        <p className="mt-6 font-typewriter text-[0.5rem] tracking-wider text-neutral-400 uppercase">
          Doc v{MAD_STUDIO_HELP_INTRO.version}
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mb-8 border-b-2 border-mad-black pb-6">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Help &amp; workflows
          </p>
          <h1 className="mt-2 font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-3xl">
            {MAD_STUDIO_HELP_INTRO.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">
            {MAD_STUDIO_HELP_INTRO.tagline}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {MAD_STUDIO_HELP_INTRO.pillars.map((pillar) => (
              <li key={pillar}>{pillar}</li>
            ))}
          </ul>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter topics…"
            className="mt-5 w-full max-w-md border-2 border-mad-black px-3 py-2 font-typewriter text-sm outline-none focus:ring-2 focus:ring-mad-lime"
          />
        </header>

        <div className="space-y-10">
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              entityQuery={entityQuery}
            />
          ))}
          {sections.length === 0 ? (
            <p className="text-sm text-neutral-600">No topics match your filter.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
