export type FudiCarouselTemplateId =
  | "feed_today"
  | "eating_tonight"
  | "tag_latest_meal"

export const FUDI_CAROUSEL_TEMPLATES: Array<{
  id: FudiCarouselTemplateId
  label: string
  headline: string
  caption: string
}> = [
  {
    id: "feed_today",
    label: "What's on the FÜDI Feed",
    headline: "Check out what's on the FÜDI Feed today",
    caption:
      "Fresh drops from local eateries and foodies across Whangārei — swipe for today's highlights. Download FÜDI, tag your spot, and share your table.",
  },
  {
    id: "eating_tonight",
    label: "Where are you eating?",
    headline: "Where are you eating tonight?",
    caption:
      "Need inspo? These spots are buzzing on FÜDI right now. Pick a slide, book a table, or save it for the weekend.",
  },
  {
    id: "tag_latest_meal",
    label: "Tag your latest meal",
    headline: "Have you posted your latest meal out?",
    caption:
      "Foodies — tag the eatery on FÜDI so your crew knows where to eat next. Eateries — repost and say thanks. Swipe for inspo from the feed.",
  },
]

export function fudiCarouselTemplate(id: FudiCarouselTemplateId) {
  return (
    FUDI_CAROUSEL_TEMPLATES.find((row) => row.id === id) ??
    FUDI_CAROUSEL_TEMPLATES[0]
  )
}
