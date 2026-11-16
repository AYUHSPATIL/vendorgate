import type { EmailSource } from "./types.ts"

export interface EmailDraftInput {
  to: string
  companyName: string
  decision: "PENDING" | "REJECTED"
  actionItems: string[]
  escalated: boolean
  forbiddenPhrases: string[]
}

export interface EmailDraft {
  to: string
  subject: string
  body: string
  source: EmailSource
}

function fallbackItems(items: string[]): string[] {
  if (items.length > 0) return items
  return ["Please contact the procurement team so we can complete this review."]
}

export function buildTemplateEmail(input: EmailDraftInput): EmailDraft {
  const company = input.companyName.trim() || "your company"
  const to = input.to.trim()
  const items = fallbackItems(input.actionItems)
  const numbered = items.map((item, index) => `${index + 1}. ${item}`).join("\n")
  const subject =
    input.decision === "REJECTED"
      ? `Vendor onboarding not approved for ${company}`
      : `Action needed to complete vendor onboarding for ${company}`
  const intro =
    input.decision === "REJECTED"
      ? `Thank you for your vendor onboarding submission for ${company}. We completed the review and cannot approve it as submitted.`
      : `Thank you for your vendor onboarding submission for ${company}. We started the review and need the items below before we can finish it.`
  const outro =
    input.decision === "REJECTED"
      ? "Please correct these points and submit the vendor request again. A new review will run on the updated submission. If a document or identifier was entered incorrectly, send the corrected version and we will recheck it."
      : "Please reply with the requested items. We will continue the review as soon as they arrive."

  const body = [
    `Dear ${company} team,`,
    "",
    intro,
    "",
    "Please address the following:",
    numbered,
    "",
    outro,
    "",
    "Kind regards,",
    "VendorGate Procurement Team",
  ].join("\n")

  return { to, subject, body, source: "Template" }
}

function readAiConfig(): { url: string; key: string } | null {
  try {
    const env = import.meta.env
    const url = env?.VITE_SUPABASE_URL?.trim()
    const key = env?.VITE_SUPABASE_ANON_KEY?.trim()
    if (!url || !key) return null
    return { url: url.replace(/\/$/, ""), key }
  } catch (error) {
    console.error("Vendor email AI config could not be read", error)
    return null
  }
}

function violatesSafety(body: string, input: EmailDraftInput): boolean {
  const haystack = body.toLowerCase()
  if (input.escalated && /fraud|payment diversion|already registered/.test(haystack)) return true
  return input.forbiddenPhrases.some((phrase) => phrase && haystack.includes(phrase.toLowerCase()))
}

export async function draftVendorEmail(input: EmailDraftInput): Promise<EmailDraft> {
  const template = buildTemplateEmail(input)
  const config = readAiConfig()
  if (!config) return template

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${config.url}/functions/v1/draft-vendor-email`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
      },
      body: JSON.stringify({
        to: input.to,
        companyName: input.companyName,
        decision: input.decision,
        actionItems: fallbackItems(input.actionItems),
        escalated: input.escalated,
        instructions: input.escalated
          ? "Do not mention fraud, payment diversion, duplicate bank accounts, or any other vendor's name. Ask only for a bank confirmation letter on bank letterhead."
          : "Explain only the supplied action items. Do not invent extra problems.",
      }),
    })
    if (!response.ok) return template
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== "object") return template
    const subject = "subject" in payload ? payload.subject : undefined
    const body = "body" in payload ? payload.body : undefined
    if (typeof subject !== "string" || typeof body !== "string") return template
    if (!subject.trim() || !body.trim()) return template
    if (violatesSafety(body, input)) return template
    return {
      to: input.to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      source: "AI-drafted",
    }
  } catch (error) {
    console.error("Vendor email AI draft failed; using the template", error)
    return template
  } finally {
    clearTimeout(timer)
  }
}
