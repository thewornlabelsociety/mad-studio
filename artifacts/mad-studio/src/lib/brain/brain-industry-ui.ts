export type DirectorChip = {
  id: string
  label: string
  prompt: string
}

export function isHospitalityBrand(industry: string, brandName?: string): boolean {
  const hay = `${industry} ${brandName ?? ""}`.toLowerCase()
  return /food|hospitality|restaurant|caf[eé]|dining|bar|brewery|pizza|fudi|füdi|eatery|taproom|bistro/.test(
    hay
  )
}

export function isFashionRetailBrand(
  industry: string,
  brandName?: string
): boolean {
  const hay = `${industry} ${brandName ?? ""}`.toLowerCase()
  return /fashion|retail|consign|boutique|apparel|luxury|vintage|worn|label|wardrobe|designer/.test(
    hay
  )
}

export function customerQuotePlaceholder(
  industry: string,
  brandName?: string
): string {
  if (isHospitalityBrand(industry, brandName)) {
    return 'e.g. "Best woodfired crust in town, arrived smoking hot!"'
  }
  if (isFashionRetailBrand(industry, brandName)) {
    return 'e.g. "Loved the trench coat, condition was pristine!"'
  }
  return 'e.g. "Incredible quality and fast service."'
}

export function brandDirectorChips(
  industry: string,
  brandName?: string
): DirectorChip[] {
  if (isHospitalityBrand(industry, brandName)) {
    return [
      {
        id: "angles",
        label: "🍕 What should our next 3 foodie drop angles be?",
        prompt: "What should our next 3 foodie drop angles be?",
      },
      {
        id: "tone",
        label:
          "🎯 Critique our casual tone and suggest 3 high-converting hooks",
        prompt:
          "Critique our casual tone and suggest 3 high-converting hooks.",
      },
      {
        id: "pitch",
        label:
          "🍻 How do we pitch midweek dining to local students & workers?",
        prompt:
          "How do we pitch midweek dining to local students and workers?",
      },
    ]
  }

  if (isFashionRetailBrand(industry, brandName)) {
    return [
      {
        id: "angles",
        label: "👗 What should our next 3 curation angles be?",
        prompt: "What should our next 3 curation angles be?",
      },
      {
        id: "tone",
        label: "🎯 Critique our editorial tone and suggest 3 new hooks",
        prompt: "Critique our editorial tone and suggest 3 new hooks.",
      },
      {
        id: "pitch",
        label:
          "🛍️ How would we pitch archival luxury to a first-time consignor?",
        prompt:
          "How would we pitch archival luxury to a skeptical first-time consignor?",
      },
    ]
  }

  return [
    {
      id: "angles",
      label: "💡 What should our next 3 content angles be?",
      prompt: "What should our next 3 content angles be?",
    },
    {
      id: "tone",
      label: "🎯 Critique our current tone and suggest 3 new hooks",
      prompt: "Critique our current tone and suggest 3 new hooks.",
    },
    {
      id: "pitch",
      label: "📣 How would we pitch our offer to a skeptical first-time buyer?",
      prompt: "How would we pitch our offer to a skeptical first-time buyer?",
    },
  ]
}
