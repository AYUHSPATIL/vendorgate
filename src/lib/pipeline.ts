import {
  NAME_PASS_THRESHOLD,
  NAME_REVIEW_THRESHOLD,
  compareNames,
  normalizeName,
} from "./fuzzy.ts"
import type { Country, Submission, Vendor } from "./types.ts"
import { isCountry } from "./types.ts"
import {
  listMissing,
  normalizeAccount,
  normalizeTaxId,
  validateBank,
  validateTaxId,
} from "./validators.ts"

export const RULE_EXPLANATION =
  "This is a rule-based decision, not a confidence score. A failure on tax ID format, bank details, or name consistency rejects the submission. Otherwise any warning — missing information, a borderline name match, or a duplicate or fraud flag — keeps it pending. If nothing fails or warns, it is approved."

export interface CheckOutcome {
  status: "pass" | "warn" | "fail"
  result: string
  detail: string
  actionItems: string[]
  escalate: boolean
  internalNotes: string[]
  elapsedMs: number
}

export interface ReviewResult {
  outcomes: CheckOutcome[]
  decision: "APPROVED" | "PENDING" | "REJECTED"
  escalate: boolean
  reasoning: string[]
  topReason: string
  internalNotes: string[]
  actionItems: string[]
  vendorToAdd: Vendor | null
}

function timed(run: () => Omit<CheckOutcome, "elapsedMs">): CheckOutcome {
  const started = performance.now()
  const outcome = run()
  const elapsedMs = Math.max(0, performance.now() - started)
  return { ...outcome, elapsedMs }
}

export function checkCompleteness(submission: Submission): CheckOutcome {
  return timed(() => {
    const missing = listMissing(submission)
    if (missing.length === 0) {
      return {
        status: "pass",
        result: "All required fields and documents are present.",
        detail:
          "Company name, country, tax ID, bank account holder, account number, a valid contact email, the India IFSC when required, and all three documents are present.",
        actionItems: [],
        escalate: false,
        internalNotes: [],
      }
    }
    const labels = missing.map((item) => item.label).join(", ")
    return {
      status: "warn",
      result: `Missing: ${labels}`,
      detail: `The submission can continue, but these items are missing: ${labels}.`,
      actionItems: missing.map((item) => item.action),
      escalate: false,
      internalNotes: [],
    }
  })
}

export function checkTaxId(submission: Submission): CheckOutcome {
  return timed(() => {
    const check = validateTaxId(submission.country, submission.taxId)
    return {
      status: check.status,
      result: check.result,
      detail: check.detail,
      actionItems: check.actionItems,
      escalate: false,
      internalNotes: [],
    }
  })
}

export function checkBank(submission: Submission): CheckOutcome {
  return timed(() => {
    const check = validateBank(submission)
    return {
      status: check.status,
      result: check.result,
      detail: check.detail,
      actionItems: check.actionItems,
      escalate: false,
      internalNotes: [],
    }
  })
}

export function checkNames(submission: Submission): CheckOutcome {
  return timed(() => {
    const company = submission.companyName.trim()
    const holder = submission.bankHolder.trim()
    if (!company || !holder) {
      return {
        status: "warn",
        result: "Name comparison needs both the company name and the account holder name.",
        detail: "One of the two names is empty, so a similarity score was not used. Completeness already lists the missing name.",
        actionItems: [],
        escalate: false,
        internalNotes: [],
      }
    }

    const comparison = compareNames(company, holder)
    const score = comparison.score.toFixed(2)
    const detail = `Normalized company: "${comparison.normalizedCompany}". Normalized account holder: "${comparison.normalizedHolder}". Token-set Jaccard ${comparison.jaccard.toFixed(2)}, normalized Levenshtein similarity ${comparison.levenshteinSimilarity.toFixed(2)}, combined score ${score}. Pass at ${NAME_PASS_THRESHOLD.toFixed(2)} or above, human review from ${NAME_REVIEW_THRESHOLD.toFixed(2)} up to but not including ${NAME_PASS_THRESHOLD.toFixed(2)}, fail below ${NAME_REVIEW_THRESHOLD.toFixed(2)}.`

    if (comparison.score >= NAME_PASS_THRESHOLD) {
      return {
        status: "pass",
        result: `Names match after normalization (score ${score})`,
        detail,
        actionItems: [],
        escalate: false,
        internalNotes: [],
      }
    }
    if (comparison.score >= NAME_REVIEW_THRESHOLD) {
      return {
        status: "warn",
        result: `Name similarity needs human review (score ${score})`,
        detail,
        actionItems: [
          `The company name and bank account holder are similar but not close enough for an automatic match (score ${score}). Please confirm they are the same legal entity, or update the submission so the names agree.`,
        ],
        escalate: false,
        internalNotes: [],
      }
    }
    return {
      status: "fail",
      result: "Account holder does not match the registered company, possible payment diversion risk",
      detail,
      actionItems: [
        `The bank account holder "${holder}" does not match the company legal name "${company}". Resubmit using an account held in the company's name, or correct the legal name so the two match.`,
      ],
      escalate: false,
      internalNotes: [],
    }
  })
}

export function checkDuplicates(submission: Submission, vendors: Vendor[]): CheckOutcome {
  return timed(() => {
    const account = normalizeAccount(submission.accountNumber)
    const taxId = normalizeTaxId(submission.taxId)
    const normalizedName = normalizeName(submission.companyName)
    const fraudNotes: string[] = []
    const otherNotes: string[] = []

    if (account) {
      for (const vendor of vendors) {
        if (normalizeAccount(vendor.accountNumber) !== account) continue
        const sameName = normalizedName !== "" && normalizeName(vendor.name) === normalizedName
        if (sameName) {
          otherNotes.push(`Duplicate registration: bank account and name already match ${vendor.name}.`)
        } else {
          fraudNotes.push(`POSSIBLE FRAUD - bank account already registered to ${vendor.name}`)
        }
      }
    }

    if (taxId) {
      for (const vendor of vendors) {
        if (normalizeTaxId(vendor.taxId) !== taxId) continue
        otherNotes.push(`Duplicate vendor: tax ID already registered to ${vendor.name}`)
      }
    }

    const notes = [...fraudNotes, ...otherNotes]
    if (notes.length === 0) {
      return {
        status: "pass",
        result: "No duplicate or fraud signals found.",
        detail: `Compared the tax ID and bank account with ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}. No matches.`,
        actionItems: [],
        escalate: false,
        internalNotes: [],
      }
    }

    const actionItems =
      fraudNotes.length > 0
        ? ["We need to verify your banking details. Please send a bank confirmation letter on bank letterhead."]
        : otherNotes.map((note) =>
            note.startsWith("Duplicate vendor")
              ? `${note}. If this was an accidental second submission, no further action is needed. Otherwise reply so procurement can reconcile the records.`
              : `${note} If this was a duplicate submission, you can disregard this message.`,
          )

    return {
      status: "warn",
      result: notes[0] ?? "A duplicate or fraud signal was found.",
      detail: `${notes.join(" ")} Checked ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}.`,
      actionItems,
      escalate: fraudNotes.length > 0,
      internalNotes: notes,
    }
  })
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function decide(submission: Submission, prior: CheckOutcome[]): ReviewResult {
  if (prior.length !== 5) {
    throw new Error("The decision stage requires the first five checks.")
  }

  const tax = prior[1]
  const bank = prior[2]
  const names = prior[3]
  const screening = prior[4]
  if (!tax || !bank || !names || !screening || !prior[0]) {
    throw new Error("A review stage was missing.")
  }

  const hardFail = tax.status === "fail" || bank.status === "fail" || names.status === "fail"
  const anyWarn = prior.some((item) => item.status === "warn")
  const decision = hardFail ? "REJECTED" : anyWarn ? "PENDING" : "APPROVED"
  const escalate = decision === "PENDING" && screening.escalate
  const actionItems = unique(prior.flatMap((item) => item.actionItems))
  const internalNotes = screening.internalNotes

  const reasoning = [
    `Completeness: ${prior[0].result}`,
    `Tax ID: ${tax.result}`,
    `Bank details: ${bank.result}`,
    `Name consistency: ${names.result}`,
    `Screening: ${screening.result}`,
  ]

  let decisionLine: string
  let result: string
  let status: CheckOutcome["status"]
  if (decision === "APPROVED") {
    status = "pass"
    result = "Approved. Every check passed."
    decisionLine =
      "Decision: Approved because every stage passed. The vendor is added to the database used for later duplicate checks."
  } else if (decision === "PENDING" && escalate) {
    status = "warn"
    result = "Pending. Escalated to human reviewer."
    decisionLine =
      "Decision: Pending because screening raised a warning. Escalated to human reviewer. The vendor email asks for a bank confirmation letter and does not mention the internal fraud flag."
  } else if (decision === "PENDING") {
    status = "warn"
    result = "Pending. One or more checks need a person to review them."
    decisionLine = "Decision: Pending because a stage warned and no tax, bank, or name check failed."
  } else {
    status = "fail"
    result = "Rejected. A tax ID, bank detail, or name check failed."
    decisionLine =
      "Decision: Rejected because tax ID format, bank details, or name consistency failed. The vendor can correct the failed items and submit again."
  }
  reasoning.push(decisionLine)

  const hard = [tax, bank, names].find((item) => item.status === "fail")
  const firstWarn = prior.find((item) => item.status === "warn")
  const topReason =
    decision === "APPROVED"
      ? "All checks passed"
      : hard
        ? hard.result
        : escalate
          ? screening.result
          : (firstWarn?.result ?? "Needs review")

  let vendorToAdd: Vendor | null = null
  if (decision === "APPROVED" && isCountry(submission.country) && submission.companyName.trim()) {
    vendorToAdd = {
      name: submission.companyName.trim(),
      country: submission.country as Country,
      taxId: normalizeTaxId(submission.taxId),
      accountNumber: normalizeAccount(submission.accountNumber),
    }
  }

  const decisionOutcome: CheckOutcome = {
    status,
    result,
    detail: `${reasoning.join("\n")}\n\n${RULE_EXPLANATION}`,
    actionItems: [],
    escalate,
    internalNotes,
    elapsedMs: 0,
  }

  return {
    outcomes: [...prior, decisionOutcome],
    decision,
    escalate,
    reasoning,
    topReason,
    internalNotes,
    actionItems,
    vendorToAdd,
  }
}

export function runStages(submission: Submission, vendors: Vendor[]): ReviewResult {
  const started = performance.now()
  const prior = [
    checkCompleteness(submission),
    checkTaxId(submission),
    checkBank(submission),
    checkNames(submission),
    checkDuplicates(submission, vendors),
  ]
  const review = decide(submission, prior)
  const decisionOutcome = review.outcomes[5]
  if (decisionOutcome) {
    decisionOutcome.elapsedMs = Math.max(0, performance.now() - started - prior.reduce((sum, item) => sum + item.elapsedMs, 0))
  }
  return review
}
