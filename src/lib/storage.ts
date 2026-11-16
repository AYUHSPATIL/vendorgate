import { cloneSeedVendors } from "../data/seedVendors.ts"
import {
  COUNTRIES,
  createPendingStages,
  isCountry,
  type Decision,
  type Documents,
  type Run,
  type StageResult,
  type StageStatus,
  type Submission,
  type Vendor,
  type VendorEmail,
  STAGE_NAMES,
} from "./types.ts"
import { normalizeAccount, normalizeTaxId } from "./validators.ts"

const STORAGE_KEY = "vendorgate.state.v1"

export interface PersistedState {
  runs: Run[]
  vendors: Vendor[]
  nextNumber: number
}

const DECISIONS = new Set<Decision>(["APPROVED", "PENDING", "REJECTED", "RUNNING", "FAILED"])
const STAGE_STATUSES = new Set<StageStatus>(["pending", "running", "pass", "warn", "fail"])

export function formatRunId(value: number): string {
  const number = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
  return `RUN-${String(number).padStart(4, "0")}`
}

export function defaultState(): PersistedState {
  return {
    runs: [],
    vendors: cloneSeedVendors(),
    nextNumber: 1,
  }
}

export function appendVendor(vendors: Vendor[], vendor: Vendor): Vendor[] {
  const account = normalizeAccount(vendor.accountNumber)
  const taxId = normalizeTaxId(vendor.taxId)
  const name = vendor.name.trim().toLowerCase()
  const exists = vendors.some(
    (item) =>
      normalizeAccount(item.accountNumber) === account &&
      normalizeTaxId(item.taxId) === taxId &&
      item.name.trim().toLowerCase() === name,
  )
  if (exists) return vendors
  return [...vendors, { ...vendor, name: vendor.name.trim(), taxId, accountNumber: account }]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readDocuments(value: unknown): Documents {
  const source = isRecord(value) ? value : {}
  return {
    businessRegistration: source.businessRegistration === true,
    taxRegistration: source.taxRegistration === true,
    bankProof: source.bankProof === true,
  }
}

function readSubmission(value: unknown): Submission | null {
  if (!isRecord(value)) return null
  const country = typeof value.country === "string" && isCountry(value.country) ? value.country : ""
  return {
    companyName: typeof value.companyName === "string" ? value.companyName : "",
    country,
    taxId: typeof value.taxId === "string" ? value.taxId : "",
    bankHolder: typeof value.bankHolder === "string" ? value.bankHolder : "",
    accountNumber: typeof value.accountNumber === "string" ? value.accountNumber : "",
    ifsc: typeof value.ifsc === "string" ? value.ifsc : "",
    email: typeof value.email === "string" ? value.email : "",
    documents: readDocuments(value.documents),
  }
}

function readStages(value: unknown): StageResult[] {
  const incoming = Array.isArray(value) ? value : []
  return STAGE_NAMES.map((name, index) => {
    const raw = incoming[index]
    if (!isRecord(raw)) {
      return createPendingStages()[index] ?? {
        name,
        status: "pending" as const,
        result: "Waiting to start",
        detail: "",
        elapsedMs: null,
      }
    }
    const status = typeof raw.status === "string" && STAGE_STATUSES.has(raw.status as StageStatus)
      ? (raw.status as StageStatus)
      : "pending"
    return {
      name,
      status,
      result: typeof raw.result === "string" ? raw.result : "",
      detail: typeof raw.detail === "string" ? raw.detail : "",
      elapsedMs: typeof raw.elapsedMs === "number" && Number.isFinite(raw.elapsedMs) ? raw.elapsedMs : null,
    }
  })
}

function readEmail(value: unknown): VendorEmail | null {
  if (!isRecord(value)) return null
  if (typeof value.subject !== "string" || typeof value.body !== "string") return null
  const source = value.source === "AI-drafted" ? "AI-drafted" : "Template"
  return {
    to: typeof value.to === "string" ? value.to : "",
    subject: value.subject,
    body: value.body,
    source,
  }
}

function readRun(value: unknown): Run | null {
  if (!isRecord(value) || typeof value.id !== "string") return null
  const submission = readSubmission(value.submission)
  if (!submission) return null
  const decision = typeof value.decision === "string" && DECISIONS.has(value.decision as Decision)
    ? (value.decision as Decision)
    : "FAILED"
  const stages = readStages(value.stages)
  let run: Run = {
    id: value.id,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    submission,
    stages,
    decision,
    escalate: value.escalate === true,
    reasoning: Array.isArray(value.reasoning) ? value.reasoning.filter((item): item is string => typeof item === "string") : [],
    topReason: typeof value.topReason === "string" ? value.topReason : "",
    internalNotes: Array.isArray(value.internalNotes)
      ? value.internalNotes.filter((item): item is string => typeof item === "string")
      : [],
    email: readEmail(value.email),
    auditLog: Array.isArray(value.auditLog)
      ? value.auditLog.flatMap((entry) => {
          if (!isRecord(entry) || typeof entry.action !== "string") return []
          return [{
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
            action: entry.action,
            note: typeof entry.note === "string" ? entry.note : "",
          }]
        })
      : [],
    error: typeof value.error === "string" ? value.error : undefined,
  }

  if (run.decision === "RUNNING") {
    const note = "This review was interrupted by a page reload. Submit it again to rerun every stage."
    run = {
      ...run,
      decision: "FAILED",
      topReason: "Review interrupted by a page reload.",
      error: note,
      stages: run.stages.map((stage) =>
        stage.status === "pending" || stage.status === "running"
          ? { ...stage, status: "fail", result: "Review interrupted by a page reload.", detail: note }
          : stage,
      ),
      auditLog: [
        ...run.auditLog,
        { timestamp: new Date().toISOString(), action: "Run failed", note },
      ],
    }
  }

  return run
}

function readVendor(value: unknown): Vendor | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== "string" || typeof value.country !== "string") return null
  if (!isCountry(value.country)) return null
  if (typeof value.taxId !== "string" || typeof value.accountNumber !== "string") return null
  return {
    name: value.name,
    country: value.country,
    taxId: value.taxId,
    accountNumber: value.accountNumber,
  }
}

function highestRunNumber(runs: Run[]): number {
  return runs.reduce((highest, run) => {
    const match = /^RUN-(\d+)$/.exec(run.id)
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return defaultState()
    const runs = Array.isArray(parsed.runs) ? parsed.runs.flatMap((item) => {
      const run = readRun(item)
      return run ? [run] : []
    }) : []
    const storedVendors = Array.isArray(parsed.vendors)
      ? parsed.vendors.flatMap((item) => {
          const vendor = readVendor(item)
          return vendor ? [vendor] : []
        })
      : []
    const vendors = storedVendors.length > 0 ? storedVendors : cloneSeedVendors()
    const storedNumber = typeof parsed.nextNumber === "number" ? parsed.nextNumber : 1
    const nextNumber = Math.max(storedNumber, highestRunNumber(runs) + 1, 1)
    return { runs, vendors, nextNumber }
  } catch (error) {
    console.error("Failed to read VendorGate storage", error)
    return defaultState()
  }
}

export function saveState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch (error) {
    console.error("Failed to write VendorGate storage", error)
    return false
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function exportRunsCsv(runs: Run[]): void {
  const header = ["id", "time", "vendor", "country", "status", "reasons"]
  const lines = [header.join(",")]
  for (const run of runs) {
    const reasons = run.reasoning.length > 0 ? run.reasoning.join(" | ") : run.topReason
    lines.push(
      [run.id, run.createdAt, run.submission.companyName, run.submission.country || "", run.decision, reasons]
        .map(csvEscape)
        .join(","),
    )
  }
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "vendorgate-runs.csv"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function vendorFromSubmission(submission: Submission): Vendor | null {
  if (!isCountry(submission.country) || !submission.companyName.trim()) return null
  if (!(COUNTRIES as readonly string[]).includes(submission.country)) return null
  return {
    name: submission.companyName.trim(),
    country: submission.country,
    taxId: normalizeTaxId(submission.taxId),
    accountNumber: normalizeAccount(submission.accountNumber),
  }
}
