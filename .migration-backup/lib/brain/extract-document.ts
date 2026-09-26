import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"

import { generateTextWithFallback } from "@/lib/ai/orchestrator"

const EXTRACTION_PROMPT =
  "Extract all operational policies, pricing rules, customer criteria, and unique brand truths from this document into bulleted knowledge for a marketing director."

async function extractPlainText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase()
  if (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv")
  ) {
    return buffer.toString("utf8")
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer })
    try {
      const parsed = await parser.getText()
      return parsed.text
    } finally {
      await parser.destroy()
    }
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  throw new Error(
    "Unsupported file type. Upload PDF, DOCX, or plain text files."
  )
}

export async function extractDocumentKnowledge(input: {
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<string> {
  const documentText = await extractPlainText(
    input.buffer,
    input.mimeType,
    input.fileName
  )

  if (!documentText.trim()) {
    throw new Error("No readable text was found in that document.")
  }

  const { text } = await generateTextWithFallback({
    prompt: [
      EXTRACTION_PROMPT,
      ``,
      `Document filename: ${input.fileName}`,
      `--- DOCUMENT CONTENT ---`,
      documentText.slice(0, 40_000),
    ].join("\n"),
  })

  const cleaned = text.trim()
  if (!cleaned) {
    throw new Error("AI extraction returned an empty summary.")
  }
  return cleaned
}
