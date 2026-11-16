export const COUNTRIES = ["India", "United States", "United Kingdom", "Germany"] as const

export type Country = (typeof COUNTRIES)[number]

export const STAGE_NAMES = [
  "Completeness check",
  "Tax ID format validation",
  "Bank details validation",
  "Name consistency",
  "Duplicate / fraud screening",
  "Decision and communication",
] as const

export type StageName = (typeof STAGE_NAMES)[number]

export interface Documents {
  businessRegistration: boolean
  taxRegistration: boolean
  bankProof: boolean
}

export interface Submission {
  companyName: string
  country: Country | ""
  taxId: string
  bankHolder: string
  accountNumber: string
  ifsc: string
  email: string
  documents: Documents
}

export interface Vendor {
  name: string
  country: Country
  taxId: string
  accountNumber: string
}

export type StageStatus = "pending" | "running" | "pass" | "warn" | "fail"

export type Decision = "APPROVED" | "PENDING" | "REJECTED" | "RUNNING" | "FAILED"

export type EmailSource = "AI-drafted" | "Template"

export interface StageResult {
  name: StageName
  status: StageStatus
  result: string
  detail: string
  elapsedMs: number | null
}

export interface AuditEntry {
  timestamp: string
  action: string
  note: string
}

export interface VendorEmail {
  to: string
  subject: string
  body: string
  source: EmailSource
}

export interface Run {
  id: string
  createdAt: string
  submission: Submission
  stages: StageResult[]
  decision: Decision
  escalate: boolean
  reasoning: string[]
  topReason: string
  internalNotes: string[]
  email: VendorEmail | null
  auditLog: AuditEntry[]
  error?: string
}

export function isCountry(value: string): value is Country {
  return (COUNTRIES as readonly string[]).includes(value)
}

export function createPendingStages(): StageResult[] {
  return STAGE_NAMES.map((name) => ({
    name,
    status: "pending" as const,
    result: "Waiting to start",
    detail: "",
    elapsedMs: null,
  }))
}

export const EMPTY_SUBMISSION: Submission = {
  companyName: "",
  country: "",
  taxId: "",
  bankHolder: "",
  accountNumber: "",
  ifsc: "",
  email: "",
  documents: {
    businessRegistration: false,
    taxRegistration: false,
    bankProof: false,
  },
}
