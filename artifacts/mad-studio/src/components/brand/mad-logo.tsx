import { Link } from "wouter"

import { cn } from "@/lib/utils"

type MadLogoSize = "sm" | "md" | "lg"

const sizeStyles: Record<MadLogoSize, string> = {
  sm: "text-[1.15rem] leading-none sm:text-[1.25rem]",
  md: "text-[1.45rem] leading-none sm:text-[1.65rem]",
  lg: "text-[2rem] leading-none sm:text-[2.35rem]",
}

type MadStudioLogoProps = {
  size?: MadLogoSize
  href?: string | null
  className?: string
}

export function MadStudioLogo({
  size = "md",
  href = "/",
  className,
}: MadStudioLogoProps) {
  const content = (
    <span
      className={cn(
        "mad-wordmark inline-flex items-baseline gap-[0.18em] text-mad-black",
        sizeStyles[size],
        className
      )}
    >
      <span>MAD</span>
      <span className="text-mad-vermillion" aria-hidden>
        ·
      </span>
      <span>STUDIO</span>
    </span>
  )

  if (href === null) {
    return content
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mad-vermillion"
      aria-label="MAD STUDIO home"
    >
      {content}
    </Link>
  )
}

/** 32×32 wordmark tile for browser tab / manifest use */
export function MadFavicon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={32}
      height={32}
      className={className}
      role="img"
      aria-label="MAD STUDIO"
    >
      <rect width="32" height="32" fill="#FFFFFF" />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="Syne, ui-sans-serif, system-ui, sans-serif"
        fontSize="11"
        fontWeight="800"
        fill="#000000"
      >
        MAD
      </text>
      <rect x="24" y="24" width="6" height="6" fill="#FF3B00" />
    </svg>
  )
}
