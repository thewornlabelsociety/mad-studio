import { toPng } from "html-to-image"

import {
  A4_PRINT_HEIGHT_PX,
  A4_PRINT_WIDTH_PX,
} from "@/lib/social-creative/promo-preview-channels"
import type { WornLabelCampaignConfig } from "@/types/social-creative"

function printFilename(config: WornLabelCampaignConfig): string {
  return `WLS-${config.colorName}-TAG-A4-print.pdf`
}

export async function exportPromoPdf(
  node: HTMLElement,
  config: WornLabelCampaignConfig
): Promise<void> {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    width: A4_PRINT_WIDTH_PX,
    height: A4_PRINT_HEIGHT_PX,
  })

  try {
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })
    pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297)
    pdf.save(printFilename(config))
  } catch {
    const win = window.open("", "_blank")
    if (!win) {
      throw new Error("Allow pop-ups to print the A4 sheet as PDF.")
    }
    win.document.write(`
      <!DOCTYPE html><html><head><title>Print</title>
      <style>@page{size:A4;margin:0}body{margin:0}</style></head>
      <body><img src="${dataUrl}" style="width:210mm;height:297mm;display:block" /></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }
}
