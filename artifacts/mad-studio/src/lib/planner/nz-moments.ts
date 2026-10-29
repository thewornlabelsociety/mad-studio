/**
 * New Zealand dates and seasons worth posting about: public holidays, sale
 * days, change of season and the occasion seasons a preloved fashion shop
 * sells into (ball, festival, wedding, races). Dates are worked out per year;
 * seasons are NZ (southern hemisphere).
 */

export type MomentKind = "holiday" | "school" | "sale" | "season" | "occasion" | "cause"

/** A ready-made Editorial announcement for the moment; every word is editable. */
export type MomentCard = {
  kicker?: string
  headline: string
  script?: string
  headlineFont?: "serif" | "script"
  details: string[]
  background: string
}

export type NzMoment = {
  id: string
  name: string
  kind: MomentKind
  start: Date
  end: Date
  /** Start promoting this many days before it begins. */
  leadDays: number
  why: string
  ideas: string[]
  card: MomentCard
}

type MomentTemplate = Omit<NzMoment, "start" | "end"> & {
  /** First and last day for a given year (end may run into the next year). */
  dates: (year: number) => [Date, Date] | null
}

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date)

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** The nth weekday (0 = Sunday) of a month; n = 1 for the first. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = day(year, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return day(year, month, 1 + offset + (n - 1) * 7)
}

/** Monday closest to a date (anniversary days). */
export function mondayNearest(date: Date): Date {
  const shift = ((1 - date.getDay() + 7) % 7 + 3) % 7 - 3
  return addDays(date, shift)
}

/** Easter Sunday (Gregorian). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const date = ((h + l - 7 * m + 114) % 31) + 1
  return day(year, month, date)
}

/** Matariki public holiday, as set in law. */
const MATARIKI: Record<number, [number, number]> = {
  2025: [6, 20],
  2026: [7, 10],
  2027: [6, 25],
  2028: [7, 14],
  2029: [7, 6],
  2030: [6, 21],
  2031: [7, 11],
  2032: [7, 2],
  2033: [6, 24],
  2034: [7, 7],
  2035: [6, 29],
}

const single = (date: Date): [Date, Date] => [date, date]

type Range = [[number, number], [number, number]]

/**
 * State school holidays (Ministry of Education). 2026 is the official
 * calendar; 2027 is from schools' published dates, so check it once the
 * Ministry confirms. Summer runs into the next year; schools go back on
 * different days in early February.
 */
const SCHOOL_HOLIDAYS: Record<number, { autumn: Range; winter: Range; spring: Range; summer: Range }> = {
  2025: { autumn: [[4, 12], [4, 27]], winter: [[7, 5], [7, 20]], spring: [[9, 27], [10, 12]], summer: [[12, 19], [2, 1]] },
  2026: { autumn: [[4, 3], [4, 19]], winter: [[7, 4], [7, 19]], spring: [[9, 26], [10, 11]], summer: [[12, 19], [2, 1]] },
  2027: { autumn: [[4, 10], [4, 26]], winter: [[7, 3], [7, 18]], spring: [[9, 25], [10, 10]], summer: [[12, 18], [2, 1]] },
}

function schoolBreak(year: number, which: "autumn" | "winter" | "spring" | "summer"): [Date, Date] | null {
  const range = SCHOOL_HOLIDAYS[year]?.[which]
  if (!range) return null
  const [[sm, sd], [em, ed]] = range
  return [day(year, sm, sd), day(em < sm ? year + 1 : year, em, ed)]
}

const SCHOOL_IDEAS = ["Holiday hours", "Kids' rack refresh", "School holiday family shopping day"]

const TEMPLATES: MomentTemplate[] = [
  {
    id: "school_autumn",
    name: "School holidays",
    kind: "school",
    dates: (y) => schoolBreak(y, "autumn"),
    leadDays: 7,
    why: "Autumn break: families out shopping, kids' clothes for winter.",
    ideas: SCHOOL_IDEAS,
    card: { kicker: "School holidays", headline: "Kids\nrack\nrefresh", details: ["Preloved kidswear", "In-store and online"], background: "faded_olive" },
  },
  {
    id: "school_winter",
    name: "School holidays",
    kind: "school",
    dates: (y) => schoolBreak(y, "winter"),
    leadDays: 7,
    why: "Winter break: coats and warm layers for growing kids.",
    ideas: [...SCHOOL_IDEAS, "Kids' coats and jackets"],
    card: { kicker: "School holidays", headline: "Warm\nlayers\nfor kids", details: ["Coats, knits and boots", "Preloved kidswear"], background: "deep_green" },
  },
  {
    id: "school_spring",
    name: "School holidays",
    kind: "school",
    dates: (y) => schoolBreak(y, "spring"),
    leadDays: 7,
    why: "Spring break: lighter clothes and a wardrobe clear-out.",
    ideas: [...SCHOOL_IDEAS, "Outgrown it? Consign it"],
    card: { kicker: "School holidays", headline: "Outgrown\nit?", script: "consign it with us", details: ["Kids' clothes wanted"], background: "vintage_beige" },
  },
  {
    id: "school_summer",
    name: "Summer school holidays",
    kind: "school",
    dates: (y) => schoolBreak(y, "summer"),
    leadDays: 10,
    why: "Six weeks off: holiday outfits, then back-to-school before February.",
    ideas: ["Summer holiday hours", "Holiday outfits for the kids", "Back-to-school uniforms and kidswear"],
    card: { kicker: "Summer holidays", headline: "Summer\nkids\nedit", details: ["Preloved kidswear", "In-store and online"], background: "faded_olive" },
  },
  {
    id: "new_year",
    name: "New year",
    kind: "holiday",
    dates: (y) => single(day(y, 1, 1)),
    leadDays: 7,
    why: "Fresh start: wardrobe clear-outs and new-year styling.",
    ideas: ["Clear your wardrobe, we'll sell it for you", "New year, new-to-you pieces", "Holiday opening hours"],
    card: { kicker: "New year", headline: "Fresh\nstart", script: "same good stuff", details: ["Consign your clear-out", "In-store and online"], background: "vintage_beige" },
  },
  {
    id: "northland_anniversary",
    name: "Auckland & Northland Anniversary",
    kind: "holiday",
    dates: (y) => single(mondayNearest(day(y, 1, 29))),
    leadDays: 10,
    why: "Long weekend in the north: hours and a weekend edit.",
    ideas: ["Long weekend hours", "Long weekend edit: summer pieces", "Beach-to-bar outfits"],
    card: { kicker: "Long weekend", headline: "Open all\nweekend", details: ["Summer edit on the racks", "Shop online anytime"], background: "deep_green" },
  },
  {
    id: "back_to_school",
    name: "Back to school",
    kind: "occasion",
    dates: (y) => [day(y, 1, 20), day(y, 2, 6)],
    leadDays: 10,
    why: "Parents buying kids' clothes and uniforms on a budget.",
    ideas: ["Kids' rack refresh", "We're searching for: kids' clothing and uniforms", "Outgrown it? Consign it"],
    card: { kicker: "Back to school", headline: "Kids\nrack\nrefresh", details: ["Preloved kidswear", "Sizes 2 to 14"], background: "faded_olive" },
  },
  {
    id: "waitangi",
    name: "Waitangi Day",
    kind: "holiday",
    dates: (y) => single(day(y, 2, 6)),
    leadDays: 7,
    why: "Public holiday: let people know your hours.",
    ideas: ["Waitangi Day hours", "Local, NZ-made labels on the racks"],
    card: { kicker: "Waitangi Day", headline: "Holiday\nhours", details: ["Check our hours", "Shop online anytime"], background: "charcoal" },
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    kind: "sale",
    dates: (y) => single(day(y, 2, 14)),
    leadDays: 14,
    why: "Date-night outfits and gifts.",
    ideas: ["Date night edit", "Red and pink rack", "Gift vouchers"],
    card: { kicker: "Valentine's", headline: "Date\nnight\nedit", script: "something special", details: ["Dresses, tops and heels", "Gift vouchers in store"], background: "charcoal" },
  },
  {
    id: "autumn",
    name: "Change of season: autumn",
    kind: "season",
    dates: (y) => [day(y, 2, 20), day(y, 3, 15)],
    leadDays: 14,
    why: "Autumn starts 1 March: swap summer stock for layers.",
    ideas: ["Autumn layers are in", "Consign your summer pieces now", "Summer sale rack"],
    card: { kicker: "Change of season", headline: "Hello\nautumn", details: ["Knits, layers and boots", "Summer sale rack"], background: "worn_taupe" },
  },
  {
    id: "easter",
    name: "Easter",
    kind: "holiday",
    dates: (y) => {
      const sunday = easterSunday(y)
      return [addDays(sunday, -2), addDays(sunday, 1)]
    },
    leadDays: 10,
    why: "Shops close Good Friday and Easter Sunday: post your hours.",
    ideas: ["Easter hours", "Long weekend sale", "Autumn edit"],
    card: { kicker: "Easter weekend", headline: "Easter\nhours", details: ["Closed Good Friday", "Closed Easter Sunday", "Shop online anytime"], background: "vintage_beige" },
  },
  {
    id: "graduation_autumn",
    name: "Graduation season",
    kind: "occasion",
    dates: (y) => [day(y, 4, 1), day(y, 5, 20)],
    leadDays: 14,
    why: "Autumn graduations: smart outfits under the gown.",
    ideas: ["Graduation edit", "Smart dresses and suits", "Something for the family photos"],
    card: { kicker: "Graduation season", headline: "Smart\nfor the\nbig day", details: ["Dresses, suits and shoes", "Preloved designer"], background: "charcoal" },
  },
  {
    id: "fashion_revolution",
    name: "Fashion Revolution Week",
    kind: "cause",
    dates: (y) => [day(y, 4, 18), day(y, 4, 24)],
    leadDays: 7,
    why: "Global week on who made our clothes: preloved fits right in.",
    ideas: ["Why preloved matters", "Behind the racks: how consignment works", "Loved clothes last"],
    card: { headline: "Good\nclothes\ngo further.", headlineFont: "script", details: ["Shop preloved", "Keep fashion circular"], background: "deep_green" },
  },
  {
    id: "anzac",
    name: "Anzac Day",
    kind: "holiday",
    dates: (y) => single(day(y, 4, 25)),
    leadDays: 7,
    why: "Shops can't open until 1pm: post your hours.",
    ideas: ["Anzac Day hours: open from 1pm"],
    card: { kicker: "Anzac Day", headline: "Open\nfrom 1pm", details: ["Lest we forget"], background: "charcoal" },
  },
  {
    id: "ball_season",
    name: "Ball season",
    kind: "occasion",
    dates: (y) => [day(y, 5, 1), day(y, 8, 31)],
    leadDays: 28,
    why: "School balls run May to August: gowns, suits and accessories.",
    ideas: ["Ball season edit", "We're searching for: ball gowns and formal wear", "Suit up for less", "Accessories to finish the look"],
    card: { kicker: "Ball season", headline: "The\nball\nedit", script: "preloved glamour", details: ["Gowns, suits and heels", "New pieces weekly"], background: "charcoal" },
  },
  {
    id: "mothers_day",
    name: "Mother's Day",
    kind: "sale",
    dates: (y) => single(nthWeekday(y, 5, 0, 2)),
    leadDays: 21,
    why: "Gifts for mum: vouchers, bags and jewellery.",
    ideas: ["Gifts for mum", "Gift vouchers", "Bags and jewellery edit"],
    card: { kicker: "Mother's Day", headline: "For\nmum", script: "with love", details: ["Gift vouchers", "Bags, scarves and jewellery"], background: "vintage_beige" },
  },
  {
    id: "winter",
    name: "Change of season: winter",
    kind: "season",
    dates: (y) => [day(y, 5, 20), day(y, 6, 15)],
    leadDays: 14,
    why: "Winter starts 1 June: coats, knits and boots.",
    ideas: ["Coat rack", "Knitwear edit", "Consign your coats now"],
    card: { kicker: "Change of season", headline: "Winter\nlayers", details: ["Coats, knits and boots", "In-store and online"], background: "deep_green" },
  },
  {
    id: "kings_birthday",
    name: "King's Birthday",
    kind: "holiday",
    dates: (y) => single(nthWeekday(y, 6, 1, 1)),
    leadDays: 10,
    why: "Long weekend: hours and a winter sale.",
    ideas: ["Long weekend hours", "Long weekend winter sale"],
    card: { kicker: "Long weekend", headline: "Winter\nsale", details: ["King's Birthday weekend", "In-store and online"], background: "worn_taupe" },
  },
  {
    id: "matariki",
    name: "Matariki",
    kind: "holiday",
    dates: (y) => (MATARIKI[y] ? single(day(y, MATARIKI[y][0], MATARIKI[y][1])) : null),
    leadDays: 10,
    why: "Māori New Year: a time to reflect, gather and look ahead.",
    ideas: ["Matariki holiday hours", "Gather together: outfits for the long weekend"],
    card: { kicker: "Matariki", headline: "Long\nweekend\nhours", details: ["Check our hours", "Shop online anytime"], background: "charcoal" },
  },
  {
    id: "plastic_free_july",
    name: "Plastic Free July",
    kind: "cause",
    dates: (y) => [day(y, 7, 1), day(y, 7, 31)],
    leadDays: 7,
    why: "A month about waste: preloved is the easy swap.",
    ideas: ["Bring your own bag", "Preloved is the easy swap", "How much a wardrobe saves"],
    card: { headline: "Same heart,\nbigger reach.", headlineFont: "script", details: ["Shop preloved", "Support local"], background: "deep_green" },
  },
  {
    id: "spring",
    name: "Change of season: spring",
    kind: "season",
    dates: (y) => [day(y, 8, 20), day(y, 9, 15)],
    leadDays: 14,
    why: "Spring starts 1 September: lighter pieces, spring clean-outs.",
    ideas: ["Spring edit", "Spring clean your wardrobe: consign with us", "Winter sale rack"],
    card: { kicker: "Change of season", headline: "Hello\nspring", details: ["Lighter layers are in", "Winter sale rack"], background: "vintage_beige" },
  },
  {
    id: "secondhand_september",
    name: "Secondhand September",
    kind: "cause",
    dates: (y) => [day(y, 9, 1), day(y, 9, 30)],
    leadDays: 10,
    why: "A month of buying only secondhand: made for a preloved shop.",
    ideas: ["Take the Secondhand September pledge", "30 days, 30 preloved finds", "Consign your clear-out"],
    card: { kicker: "Secondhand September", headline: "Shop\npreloved\nNZ", details: ["Womens", "Mens", "Kids"], background: "faded_olive" },
  },
  {
    id: "fathers_day",
    name: "Father's Day",
    kind: "sale",
    dates: (y) => single(nthWeekday(y, 9, 0, 1)),
    leadDays: 21,
    why: "Gifts for dad: shirts, jackets, vouchers.",
    ideas: ["Gifts for dad", "Menswear edit", "Gift vouchers"],
    card: { kicker: "Father's Day", headline: "For\ndad", details: ["Menswear edit", "Gift vouchers"], background: "charcoal" },
  },
  {
    id: "wedding_season",
    name: "Wedding season",
    kind: "occasion",
    dates: (y) => [day(y, 10, 1), day(y + 1, 4, 30)],
    leadDays: 28,
    why: "October to April: guest dresses, suits and hats.",
    ideas: ["Wedding guest edit", "Don't wear it once: buy preloved", "We're searching for: occasion dresses"],
    card: { kicker: "Wedding season", headline: "The\nguest\nedit", script: "something new-to-you", details: ["Dresses, suits and heels", "Preloved designer"], background: "vintage_beige" },
  },
  {
    id: "labour_day",
    name: "Labour Day",
    kind: "sale",
    dates: (y) => {
      const monday = nthWeekday(y, 10, 1, 4)
      return [addDays(monday, -2), monday]
    },
    leadDays: 10,
    why: "Labour weekend is a big NZ sale weekend.",
    ideas: ["Labour weekend sale", "Long weekend hours"],
    card: { kicker: "Labour weekend", headline: "Long\nweekend\nsale", details: ["Saturday to Monday", "In-store and online"], background: "worn_taupe" },
  },
  {
    id: "halloween",
    name: "Halloween",
    kind: "occasion",
    dates: (y) => single(day(y, 10, 31)),
    leadDays: 21,
    why: "Costumes from the racks: cheaper and no waste.",
    ideas: ["Costume ideas from the racks", "Thrift your costume", "Dress-up box finds"],
    card: { kicker: "Halloween", headline: "Thrift\nyour\ncostume", details: ["Dress-ups from the racks"], background: "charcoal" },
  },
  {
    id: "race_season",
    name: "Race season",
    kind: "occasion",
    dates: (y) => [nthWeekday(y, 11, 2, 1), day(y + 1, 3, 15)],
    leadDays: 21,
    why: "Melbourne Cup to Auckland Cup: race-day dresses, suits and hats.",
    ideas: ["Race day edit", "Hats and fascinators", "Suit up for the races"],
    card: { kicker: "Race season", headline: "Race\nday\nready", details: ["Dresses, suits and hats", "Preloved designer"], background: "deep_green" },
  },
  {
    id: "black_friday",
    name: "Black Friday",
    kind: "sale",
    dates: (y) => {
      const friday = addDays(nthWeekday(y, 11, 4, 4), 1)
      return [friday, addDays(friday, 3)]
    },
    leadDays: 14,
    why: "The biggest sale weekend. Or go green: buy preloved instead.",
    ideas: ["Black Friday sale", "Green Friday: shop preloved instead", "Cyber Monday online deals"],
    card: { kicker: "Black Friday", headline: "Black\nFriday\nsale", details: ["Friday to Monday", "In-store and online"], background: "charcoal" },
  },
  {
    id: "christmas_functions",
    name: "Christmas functions",
    kind: "occasion",
    dates: (y) => [day(y, 11, 20), day(y, 12, 20)],
    leadDays: 14,
    why: "Work dos and parties: outfits that don't cost the earth.",
    ideas: ["Christmas party edit", "Sparkle rack", "Work do outfits under $50"],
    card: { kicker: "Party season", headline: "Christmas\nparty\nedit", script: "all that sparkles", details: ["Dresses, sequins and heels"], background: "charcoal" },
  },
  {
    id: "summer",
    name: "Change of season: summer",
    kind: "season",
    dates: (y) => [day(y, 11, 20), day(y, 12, 15)],
    leadDays: 14,
    why: "Summer starts 1 December: dresses, linen and swim.",
    ideas: ["Summer edit", "Linen and sundresses", "Consign your winter coats"],
    card: { kicker: "Change of season", headline: "Hello\nsummer", details: ["Dresses, linen and sandals"], background: "vintage_beige" },
  },
  {
    id: "festival_season",
    name: "Festival season",
    kind: "occasion",
    dates: (y) => [day(y, 12, 1), day(y + 1, 3, 15)],
    leadDays: 21,
    why: "Rhythm and Vines to Laneway: festival outfits and statement pieces.",
    ideas: ["Festival edit", "Statement pieces", "We're searching for: festival and vintage pieces"],
    card: { kicker: "Festival season", headline: "The\nfestival\nedit", details: ["Vintage, denim and statement pieces"], background: "faded_olive" },
  },
  {
    id: "graduation_summer",
    name: "Graduation season",
    kind: "occasion",
    dates: (y) => [day(y, 12, 1), day(y, 12, 20)],
    leadDays: 14,
    why: "December graduations: smart outfits under the gown.",
    ideas: ["Graduation edit", "Smart dresses and suits"],
    card: { kicker: "Graduation season", headline: "Smart\nfor the\nbig day", details: ["Dresses, suits and shoes"], background: "charcoal" },
  },
  {
    id: "christmas",
    name: "Christmas",
    kind: "sale",
    dates: (y) => single(day(y, 12, 25)),
    leadDays: 35,
    why: "Gift guides, vouchers and holiday hours.",
    ideas: ["Gift guide under $30", "Gift vouchers", "Christmas hours", "Last days to shop online"],
    card: { kicker: "Christmas", headline: "The\ngift\nedit", script: "wrapped with love", details: ["Gift vouchers", "Gifts under $30"], background: "deep_green" },
  },
  {
    id: "boxing_day",
    name: "Boxing Day",
    kind: "sale",
    dates: (y) => single(day(y, 12, 26)),
    leadDays: 10,
    why: "The big post-Christmas sale day.",
    ideas: ["Boxing Day sale", "Sale rack refresh"],
    card: { kicker: "Boxing Day", headline: "Boxing\nDay\nsale", details: ["In-store and online"], background: "worn_taupe" },
  },
  {
    id: "new_years_eve",
    name: "New Year's Eve",
    kind: "occasion",
    dates: (y) => single(day(y, 12, 31)),
    leadDays: 14,
    why: "Party outfits for the last night of the year.",
    ideas: ["NYE party edit", "Sequins and statement pieces"],
    card: { kicker: "New Year's Eve", headline: "Party\nready", script: "see you next year", details: ["Sequins, satin and heels"], background: "charcoal" },
  },
]

/** All moments that start in a given year. */
export function momentsForYear(year: number): NzMoment[] {
  const out: NzMoment[] = []
  for (const { dates, ...rest } of TEMPLATES) {
    const range = dates(year)
    if (!range) continue
    out.push({ ...rest, start: range[0], end: range[1] })
  }
  return out
}

/**
 * Moments to plan for now: running today, or starting within `days` (or
 * already inside their lead time). Soonest first.
 */
export function upcomingMoments(today: Date, days = 75): NzMoment[] {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const until = addDays(from, days)
  const year = from.getFullYear()
  return [year - 1, year, year + 1]
    .flatMap(momentsForYear)
    .filter((moment) => moment.end >= from && addDays(moment.start, -moment.leadDays) <= until)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Every moment the template list knows, by id, for the dates nearest `today`. */
export function findMoment(id: string, today: Date): NzMoment | null {
  return upcomingMoments(today, 400).find((moment) => moment.id === id) ?? null
}

/** Long seasons (ball, wedding...) only show on the day they start. */
const SHORT_RANGE_DAYS = 21

/**
 * NZ moments to tag on a calendar day: one-day dates on the day, school
 * holidays and short runs (long weekends) on every day, and long seasons and
 * change-of-season windows on their first day only.
 */
export function momentsOnDay(date: Date): NzMoment[] {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const year = date.getFullYear()
  return [year - 1, year]
    .flatMap(momentsForYear)
    .filter((moment) => {
      const start = moment.start.getTime()
      const end = moment.end.getTime()
      if (target < start || target > end) return false
      const length = Math.round((end - start) / 86_400_000) + 1
      const everyDay =
        moment.kind === "school" || (length <= SHORT_RANGE_DAYS && moment.kind !== "season")
      return everyDay || target === start
    })
}

/** Whole days from `today` to the moment's start (0 or less once it's on). */
export function daysUntil(moment: NzMoment, today: Date): number {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((moment.start.getTime() - from.getTime()) / 86_400_000)
}
