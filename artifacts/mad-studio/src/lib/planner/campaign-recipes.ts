import { findMoment, type MomentCard, type NzMoment } from "./nz-moments.ts"

/** The app tool a campaign step is made with. */
export type CampaignTool =
  | "announcement"
  | "sale_rack"
  | "dot_special"
  | "week_outfits"
  | "wants"
  | "stories"
  | "studio"

export const CAMPAIGN_TOOL_LABEL: Record<CampaignTool, string> = {
  announcement: "Announcement card",
  sale_rack: "Sale rack carousel",
  dot_special: "Dot special",
  week_outfits: "Week of outfits",
  wants: "We're searching for",
  stories: "New arrival Stories",
  studio: "Short video",
}

type StepTemplate = {
  /** Days from the anchor: the moment's start (or its end with from: "end"). */
  offset: number
  from?: "start" | "end"
  tool: CampaignTool
  title: string
  detail: string
  /** Words for an announcement step; {start}, {end} and {name} fill in. */
  card?: MomentCard
}

export type CampaignRecipe = {
  id: string
  name: string
  why: string
  /** Dates come from this NZ moment; null means you pick the start date. */
  momentId: string | null
  /** Length when you pick the date yourself (days, start included). */
  days?: number
  steps: StepTemplate[]
}

export type CampaignStep = {
  id: string
  /** yyyy-mm-dd */
  date: string
  tool: CampaignTool
  title: string
  detail: string
  card?: MomentCard
  done: boolean
}

export type CampaignPlan = {
  id: string
  recipeId: string
  name: string
  start: string
  end: string
  createdAt: string
  steps: CampaignStep[]
}

/** Steps for a dated occasion season: ask for stock, launch the edit, style it, film it. */
function occasionSteps(name: string, card: (m: string) => MomentCard, wanted: string): StepTemplate[] {
  return [
    { offset: -21, tool: "wants", title: `Searching for: ${wanted}`, detail: "Ask for the stock you'll need, three weeks out." },
    { offset: -14, tool: "announcement", title: `${name} edit launch`, detail: "The card for the feed and Stories.", card: card(name) },
    { offset: -10, tool: "week_outfits", title: `${name} looks`, detail: "A carousel of outfits from the racks." },
    { offset: -7, tool: "studio", title: "Try-on video", detail: "A short reel trying on the edit." },
    { offset: 0, tool: "stories", title: "Stories from the edit", detail: "New arrivals that suit the occasion." },
  ]
}

export const CAMPAIGN_RECIPES: CampaignRecipe[] = [
  {
    id: "black_friday",
    name: "Black Friday",
    why: "Tease it, show the rack, then go live in-store, online and on the website.",
    momentId: "black_friday",
    steps: [
      { offset: -7, tool: "announcement", title: "Black Friday is coming", detail: "Teaser card for feed and Stories.", card: { kicker: "Coming soon", headline: "Black\nFriday", script: "is coming", details: ["{start} to {end}", "In-store and online"], background: "charcoal" } },
      { offset: -3, tool: "sale_rack", title: "Sneak peek at the sale rack", detail: "Carousel of what's marked down." },
      { offset: -1, tool: "dot_special", title: "Dot special for the weekend", detail: "Story and the A4 sheet for the shop." },
      { offset: 0, tool: "announcement", title: "Black Friday sale is on", detail: "Feed card, Stories, and put it on the website.", card: { kicker: "On now", headline: "Black\nFriday\nsale", details: ["{start} to {end}", "In-store and online"], background: "charcoal" } },
      { offset: 0, from: "end", tool: "announcement", title: "Last day of the sale", detail: "Final-hours Story.", card: { kicker: "Last day", headline: "Final\nhours", details: ["Black Friday ends tonight"], background: "worn_taupe" } },
    ],
  },
  {
    id: "christmas",
    name: "Christmas",
    why: "Gift ideas, party outfits, vouchers and holiday hours, then the Boxing Day sale.",
    momentId: "christmas",
    steps: [
      { offset: -35, tool: "wants", title: "Searching for: party wear and gifts", detail: "Stock up on sequins, bags and jewellery." },
      { offset: -28, tool: "announcement", title: "The gift edit", detail: "Gift ideas card.", card: { kicker: "Christmas", headline: "The\ngift\nedit", script: "wrapped with love", details: ["Gift vouchers", "Gifts under $30"], background: "deep_green" } },
      { offset: -21, tool: "week_outfits", title: "Party season outfits", detail: "A week of Christmas function looks." },
      { offset: -14, tool: "announcement", title: "Gift vouchers", detail: "Vouchers card.", card: { kicker: "Stuck for a gift?", headline: "Gift\nvouchers", details: ["Any amount", "In-store and online"], background: "vintage_beige" } },
      { offset: -7, tool: "announcement", title: "Christmas hours", detail: "Holiday hours card.", card: { kicker: "Christmas", headline: "Holiday\nhours", details: ["Check our hours", "Shop online anytime"], background: "charcoal" } },
      { offset: -2, tool: "stories", title: "Last-minute gift Stories", detail: "New arrivals that make good gifts." },
      { offset: 1, tool: "announcement", title: "Boxing Day sale", detail: "Sale card.", card: { kicker: "Boxing Day", headline: "Boxing\nDay\nsale", details: ["In-store and online"], background: "worn_taupe" } },
    ],
  },
  {
    id: "ball_season",
    name: "Ball season",
    why: "School balls run May to August: gowns, suits and accessories.",
    momentId: "ball_season",
    steps: occasionSteps(
      "Ball",
      () => ({ kicker: "Ball season", headline: "The\nball\nedit", script: "preloved glamour", details: ["Gowns, suits and heels", "New pieces weekly"], background: "charcoal" }),
      "ball gowns and formal wear"
    ),
  },
  {
    id: "wedding_season",
    name: "Wedding season",
    why: "Guest outfits from October to April.",
    momentId: "wedding_season",
    steps: occasionSteps(
      "Wedding guest",
      () => ({ kicker: "Wedding season", headline: "The\nguest\nedit", script: "something new-to-you", details: ["Dresses, suits and heels"], background: "vintage_beige" }),
      "occasion dresses and suits"
    ),
  },
  {
    id: "race_season",
    name: "Race season",
    why: "Melbourne Cup to Auckland Cup: race-day dresses, suits and hats.",
    momentId: "race_season",
    steps: occasionSteps(
      "Race day",
      () => ({ kicker: "Race season", headline: "Race\nday\nready", details: ["Dresses, suits and hats"], background: "deep_green" }),
      "race-day dresses and hats"
    ),
  },
  {
    id: "festival_season",
    name: "Festival season",
    why: "Summer festivals: vintage, denim and statement pieces.",
    momentId: "festival_season",
    steps: occasionSteps(
      "Festival",
      () => ({ kicker: "Festival season", headline: "The\nfestival\nedit", details: ["Vintage, denim and statement pieces"], background: "faded_olive" }),
      "festival and vintage pieces"
    ),
  },
  {
    id: "christmas_functions",
    name: "Christmas party season",
    why: "Work dos and parties: outfits that don't cost the earth.",
    momentId: "christmas_functions",
    steps: occasionSteps(
      "Party",
      () => ({ kicker: "Party season", headline: "Christmas\nparty\nedit", script: "all that sparkles", details: ["Dresses, sequins and heels"], background: "charcoal" }),
      "sequins and party dresses"
    ),
  },
  {
    id: "change_of_season",
    name: "Change of season",
    why: "Ask for the new season's stock, launch it, style it, then mark down the old.",
    momentId: "summer",
    steps: [
      { offset: -7, tool: "wants", title: "Searching for the new season", detail: "Ask for the stock you want consigned." },
      { offset: 0, tool: "announcement", title: "New season card", detail: "Feed card and Stories.", card: { kicker: "Change of season", headline: "{name}", details: ["New pieces on the racks", "In-store and online"], background: "vintage_beige" } },
      { offset: 3, tool: "week_outfits", title: "A week of new-season outfits", detail: "Seven looks from the new stock." },
      { offset: 7, tool: "sale_rack", title: "End of season markdowns", detail: "Last season's pieces on the sale rack." },
    ],
  },
  {
    id: "sale_weekend",
    name: "Sale weekend",
    why: "A short sale: teaser, dot special, on now, last day.",
    momentId: null,
    days: 3,
    steps: [
      { offset: -3, tool: "announcement", title: "Sale coming this weekend", detail: "Teaser card.", card: { kicker: "This weekend", headline: "Sale\nweekend", details: ["{start} to {end}", "In-store and online"], background: "worn_taupe" } },
      { offset: -1, tool: "dot_special", title: "Dot special", detail: "Story and the A4 sheet for the shop." },
      { offset: 0, tool: "announcement", title: "Sale is on", detail: "On-now card and the website.", card: { kicker: "On now", headline: "Sale\nweekend", details: ["Until {end}", "In-store and online"], background: "charcoal" } },
      { offset: 0, from: "end", tool: "stories", title: "Last day Stories", detail: "What's left on the sale rack." },
    ],
  },
  {
    id: "website_launch",
    name: "Website launch",
    why: "Your moodboard cards in order: new look, online, buy sell discover, marketplace.",
    momentId: null,
    days: 1,
    steps: [
      { offset: -5, tool: "announcement", title: "A new look", detail: "Teaser card.", card: { headline: "A new\nlook", script: "for Worn Label Society", details: [], background: "charcoal" } },
      { offset: -3, tool: "announcement", title: "Buy sell discover", detail: "What's coming.", card: { kicker: "Same vibe\nBigger possibilities", headline: "Buy\nsell\ndiscover", details: ["All in one place"], background: "worn_taupe" } },
      { offset: -1, tool: "announcement", title: "Same good stuff", detail: "Reassure regulars.", card: { headline: "Same\ngood\nstuff", details: ["Quality", "preloved fashion", "now easier", "than ever"], background: "vintage_beige" } },
      { offset: 0, tool: "announcement", title: "We are now online", detail: "Launch day card, and the website.", card: { headline: "We are\nnow\nonline!!", details: ["Shop", "preloved", "NZ"], background: "deep_green" } },
      { offset: 2, tool: "week_outfits", title: "Shop the looks online", detail: "Outfits with links to buy." },
      { offset: 4, tool: "announcement", title: "More ways to shop", detail: "Follow-up card.", card: { headline: "Same\ncommunity\nmore\nways to shop", details: ["In-store", "Online", "NZ wide"], background: "charcoal" } },
    ],
  },
  {
    id: "new_drop",
    name: "New drop",
    why: "A big intake: tease it, launch it, then style it.",
    momentId: null,
    days: 1,
    steps: [
      { offset: -2, tool: "announcement", title: "Fresh drop coming", detail: "Teaser card.", card: { kicker: "{start}", headline: "Fresh\ndrop", script: "first in, best dressed", details: ["New pieces on the racks"], background: "deep_green" } },
      { offset: 0, tool: "stories", title: "New arrival Stories", detail: "The new pieces as Stories." },
      { offset: 0, tool: "announcement", title: "The drop is in", detail: "Feed card.", card: { kicker: "New in", headline: "Fresh\ndrop", details: ["Over 40 new pieces", "In-store and online"], background: "charcoal" } },
      { offset: 1, tool: "week_outfits", title: "Outfits from the drop", detail: "Seven looks from the new stock." },
    ],
  },
]

export function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function parseYmd(text: string): Date {
  const [y, m, d] = text.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function short(date: Date): string {
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })
}

/** The NZ moment a recipe follows, nearest to today (change of season picks the next season). */
export function recipeMoment(recipe: CampaignRecipe, today: Date): NzMoment | null {
  if (recipe.id === "change_of_season") {
    const seasons = ["autumn", "winter", "spring", "summer"]
      .map((id) => findMoment(id, today))
      .filter((moment): moment is NzMoment => moment != null)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    return seasons[0] ?? null
  }
  return recipe.momentId ? findMoment(recipe.momentId, today) : null
}

function fill(text: string, values: { start: Date; end: Date; name: string }): string {
  return text
    .replaceAll("{start}", short(values.start))
    .replaceAll("{end}", short(values.end))
    .replaceAll("{name}", values.name)
}

/** A plan with real dates; steps in date order. */
export function buildCampaign(input: {
  recipe: CampaignRecipe
  start: Date
  end?: Date
  /** Season name for change of season, e.g. "Hello\nsummer". */
  name?: string
  now?: Date
}): CampaignPlan {
  const { recipe, start } = input
  const end = input.end ?? addDays(start, Math.max((recipe.days ?? 1) - 1, 0))
  const name = input.name ?? recipe.name
  const id = `camp_${(input.now ?? new Date()).getTime().toString(36)}`
  const steps = recipe.steps
    .map((step, index) => {
      const anchor = step.from === "end" ? end : start
      const card = step.card
        ? {
            ...step.card,
            kicker: step.card.kicker ? fill(step.card.kicker, { start, end, name }) : undefined,
            headline: fill(step.card.headline, { start, end, name }),
            details: step.card.details.map((line) => fill(line, { start, end, name })),
          }
        : undefined
      return {
        id: `${id}_${index}`,
        date: ymd(addDays(anchor, step.offset)),
        tool: step.tool,
        title: step.title,
        detail: step.detail,
        card,
        done: false,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    id,
    recipeId: recipe.id,
    name: recipe.id === "change_of_season" ? `Change of season: ${name.replace(/\n/g, " ")}` : recipe.name,
    start: ymd(start),
    end: ymd(end),
    createdAt: (input.now ?? new Date()).toISOString(),
    steps,
  }
}

/**
 * True when a planned campaign already covers this NZ moment on this day,
 * so the plain date pill would only repeat it.
 */
export function campaignCovers(plans: CampaignPlan[], moment: NzMoment, date: Date): boolean {
  const day = ymd(date)
  return plans.some((plan) => {
    if (day < plan.start || day > plan.end) return false
    const recipe = CAMPAIGN_RECIPES.find((row) => row.id === plan.recipeId)
    if (!recipe) return false
    return recipe.id === "change_of_season" ? moment.kind === "season" : recipe.momentId === moment.id
  })
}

/** Campaign steps on a day, across plans. */
export function campaignStepsOn(plans: CampaignPlan[], date: Date): Array<{ plan: CampaignPlan; step: CampaignStep }> {
  const day = ymd(date)
  return plans.flatMap((plan) =>
    plan.steps.filter((step) => step.date === day).map((step) => ({ plan, step }))
  )
}
