"use client"

import type { LucideIcon, LucideProps } from "lucide-react"
import {
  Bot,
  Facebook,
  Instagram,
  Mail,
  Music2,
  Pizza,
  Radio,
  ShoppingBasket,
  Smartphone,
  Soup,
  Store,
  Tag,
  Ticket,
} from "lucide-react"

/**
 * Shared Lucide icons for app-wide markers. The app uses Lucide icons only —
 * never emoji — so data carries a kind and the UI picks the icon here.
 */

const DROP_KIND_ICONS: Record<string, LucideIcon> = {
  foodie_post: Soup,
  eatery_spotlight: Store,
  platform_promo: Smartphone,
  dish_drop: Pizza,
  live_deal: Tag,
  event: Ticket,
  pantry: ShoppingBasket,
}

export function DropKindIcon({
  kind,
  ...props
}: { kind: string } & LucideProps) {
  const Icon = DROP_KIND_ICONS[kind] ?? Tag
  return <Icon aria-hidden {...props} />
}

export function IntakeBadgeIcon({
  kind,
  ...props
}: { kind: "mobile" | "auto" } & LucideProps) {
  const Icon = kind === "mobile" ? Smartphone : Bot
  return <Icon aria-hidden {...props} />
}

export function PlatformIcon({
  platform,
  ...props
}: { platform: string } & LucideProps) {
  const Icon: LucideIcon = platform.startsWith("instagram")
    ? Instagram
    : platform === "facebook"
      ? Facebook
      : platform === "tiktok"
        ? Music2
        : platform.startsWith("email")
          ? Mail
          : Radio
  return <Icon aria-hidden {...props} />
}
