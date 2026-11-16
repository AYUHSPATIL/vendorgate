import { type Country, type Submission } from "./types.ts"

export interface TaxRule {
  country: Country
  name: string
  shortName: string
  example: string
  pattern: string
  regex: RegExp
}

export const TAX_RULES: readonly TaxRule[] = [
  {
    country: "India",
    name: "India GSTIN",
    shortName: "India GSTIN",
    example: "27AABCA1234F1Z5",
    pattern: "2 digits, 5 letters, 4 digits, 1 letter, 1 letter or digit (not 0), Z, 1 letter or digit",
    regex: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  },
  {
    country: "United States",
    name: "US EIN",
    shortName: "US EIN",
    example: "12-3456789",
    pattern: "2 digits, a hyphen, then 7 digits",
    regex: /^\d{2}-\d{7}$/,
  },
  {
    country: "United Kingdom",
    name: "UK VAT",
    shortName: "UK VAT",
    example: "GB123456789",
    pattern: "GB followed by 9 digits",
    regex: /^GB\d{9}$/,
  },
  {
    country: "Germany",
    name: "Germany VAT",
    shortName: "Germany VAT",
    example: "DE123456789",
    pattern: "DE followed by 9 digits",
    regex: /^DE\d{9}$/,
  },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

export function taxRuleFor(country: Country): TaxRule {
  const rule = TAX_RULES.find((item) => item.country === country)
  if (!rule) {
    throw new Error(`No tax rule for ${country}`)
  }
  return rule
}

export function taxHint(country: Country | ""): string {
  if (!country) return "Select a country to see the expected tax ID format."
  const rule = taxRuleFor(country)
  return `Expected ${rule.shortName}: ${rule.example}`
}

export function bankHint(country: Country | ""): string {
  switch (country) {
    case "India":
      return "Account number: 9 to 18 digits. IFSC: 4 letters, a 0, then 6 letters or digits (HDFC0001234)."
    case "United States":
      return "Account number: 8 to 17 digits. No IBAN or IFSC is required."
    case "United Kingdom":
      return "IBAN starting with GB. Structure and the mod-97 checksum are both checked."
    case "Germany":
      return "IBAN starting with DE. Structure and the mod-97 checksum are both checked."
    default:
      return "Select a country to see the expected bank format."
  }
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function normalizeAccount(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase()
}

export function normalizeTaxId(value: string): string {
  return value.trim().toUpperCase()
}

export interface MissingItem {
  label: string
  action: string
}

const MISSING_ACTIONS: Record<string, string> = {
  "Company legal name": "Provide the company legal name.",
  Country: "Provide the country of registration.",
  "Tax ID": "Provide the tax ID.",
  "Bank account holder name": "Provide the bank account holder name.",
  "Bank account number": "Provide the bank account number or IBAN.",
  "Contact email": "Provide a contact email address.",
  "Valid contact email": "Provide a valid contact email address.",
  "IFSC code": "Provide the IFSC code for the Indian bank account.",
  "Business registration certificate": "Provide the business registration certificate.",
  "Tax registration certificate": "Provide the tax registration certificate.",
  "Bank proof": "Provide bank proof (cancelled cheque or statement).",
}

export function listMissing(submission: Submission): MissingItem[] {
  const labels: string[] = []
  if (!submission.companyName.trim()) labels.push("Company legal name")
  if (!submission.country) labels.push("Country")
  if (!submission.taxId.trim()) labels.push("Tax ID")
  if (!submission.bankHolder.trim()) labels.push("Bank account holder name")
  if (!submission.accountNumber.trim()) labels.push("Bank account number")
  if (!submission.email.trim()) labels.push("Contact email")
  else if (!isValidEmail(submission.email)) labels.push("Valid contact email")
  if (submission.country === "India" && !submission.ifsc.trim()) labels.push("IFSC code")
  if (!submission.documents.businessRegistration) labels.push("Business registration certificate")
  if (!submission.documents.taxRegistration) labels.push("Tax registration certificate")
  if (!submission.documents.bankProof) labels.push("Bank proof")

  return labels.map((label) => ({
    label,
    action: MISSING_ACTIONS[label] ?? `Provide ${label}.`,
  }))
}

export interface TaxCheck {
  status: "pass" | "warn" | "fail"
  result: string
  detail: string
  actionItems: string[]
}

export function validateTaxId(country: Country | "", taxId: string): TaxCheck {
  if (!country) {
    return {
      status: "warn",
      result: "Tax ID format was not checked because the country is missing.",
      detail: "Select India, the United States, the United Kingdom, or Germany before the format can be tested.",
      actionItems: [],
    }
  }

  const rule = taxRuleFor(country)
  const value = normalizeTaxId(taxId)
  if (!value) {
    return {
      status: "warn",
      result: "Tax ID is missing.",
      detail: `Expected ${rule.name}: ${rule.pattern}. Example: ${rule.example}.`,
      actionItems: [],
    }
  }

  if (rule.regex.test(value)) {
    return {
      status: "pass",
      result: `Tax ID matches the ${rule.shortName} format.`,
      detail: `Checked "${value}" against ${rule.name} (${rule.pattern}). Example: ${rule.example}.`,
      actionItems: [],
    }
  }

  const other = TAX_RULES.find((item) => item.country !== country && item.regex.test(value))
  const otherNote = other ? ` Value looks like a ${other.shortName} but country is ${country}.` : ""
  const result = `Tax ID does not match the ${rule.name} format expected for ${country}.${otherNote}`
  return {
    status: "fail",
    result,
    detail: `Received "${value}". Expected ${rule.pattern}. Example: ${rule.example}.${otherNote}`,
    actionItems: [
      `The tax ID "${value}" does not match the ${rule.name} format required for ${country} (example ${rule.example}).${otherNote} Please send a valid ${rule.shortName}, or correct the country if this tax ID belongs somewhere else, and resubmit.`,
    ],
  }
}

export function ibanMod97(iban: string): number {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const expanded = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char
    for (const digit of expanded) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder
}

export interface BankCheck {
  status: "pass" | "warn" | "fail"
  result: string
  detail: string
  actionItems: string[]
}

function expectedIbanPrefix(country: Country): "GB" | "DE" | null {
  if (country === "United Kingdom") return "GB"
  if (country === "Germany") return "DE"
  return null
}

export function validateBank(submission: Submission): BankCheck {
  if (!submission.country) {
    return {
      status: "warn",
      result: "Bank details were not checked because the country is missing.",
      detail: "A country is required to choose the IBAN, IFSC, or account-number rule.",
      actionItems: [],
    }
  }

  if (submission.country === "India") return validateIndiaBank(submission)
  if (submission.country === "United States") return validateUsAccount(submission.accountNumber)
  return validateIbanAccount(submission.country, submission.accountNumber)
}

function validateIndiaBank(submission: Submission): BankCheck {
  const account = submission.accountNumber.replace(/\s+/g, "")
  const ifsc = submission.ifsc.replace(/\s+/g, "").toUpperCase()
  const failures: string[] = []
  const gaps: string[] = []
  const actions: string[] = []

  if (!account) {
    gaps.push("Account number is missing.")
  } else if (!/^\d{9,18}$/.test(account)) {
    failures.push("Indian account numbers must be 9 to 18 digits.")
    actions.push("Correct the bank account number so it is 9 to 18 digits, with no letters.")
  }

  if (!ifsc) {
    gaps.push("IFSC code is missing.")
  } else if (!IFSC_PATTERN.test(ifsc)) {
    failures.push("IFSC must be 4 letters, a 0, then 6 letters or digits (for example HDFC0001234).")
    actions.push("Correct the IFSC code. Expected format: 4 letters, a 0, then 6 letters or digits, for example HDFC0001234.")
  }

  if (failures.length > 0) {
    return {
      status: "fail",
      result: failures.join(" "),
      detail: [...failures, ...gaps].join(" "),
      actionItems: actions,
    }
  }
  if (gaps.length > 0) {
    return {
      status: "warn",
      result: gaps.join(" "),
      detail: "Missing bank fields stay a warning here. A value that is present but malformed is a failure.",
      actionItems: [],
    }
  }
  return {
    status: "pass",
    result: "Bank details are valid for India.",
    detail: `IFSC ${ifsc} matches the required pattern and the account number has ${account.length} digits.`,
    actionItems: [],
  }
}

function validateUsAccount(accountNumber: string): BankCheck {
  const account = accountNumber.replace(/\s+/g, "")
  if (!account) {
    return {
      status: "warn",
      result: "Account number is missing.",
      detail: "US account numbers must be 8 to 17 digits once a value is provided.",
      actionItems: [],
    }
  }
  if (!/^\d{8,17}$/.test(account)) {
    return {
      status: "fail",
      result: "US account numbers must be 8 to 17 digits.",
      detail: `Received "${accountNumber.trim()}". Letters, IBAN prefixes, and other lengths are not accepted for the United States.`,
      actionItems: ["Correct the US account number so it is 8 to 17 digits and resubmit."],
    }
  }
  return {
    status: "pass",
    result: "Bank details are valid for the United States.",
    detail: `Account number has ${account.length} digits, which is inside the 8 to 17 digit rule. No IFSC is required.`,
    actionItems: [],
  }
}

function validateIbanAccount(country: "United Kingdom" | "Germany", accountNumber: string): BankCheck {
  const iban = normalizeAccount(accountNumber)
  const expected = expectedIbanPrefix(country)
  if (!iban) {
    return {
      status: "warn",
      result: "IBAN is missing.",
      detail: `${country} accounts are checked as IBANs starting with ${expected}.`,
      actionItems: [],
    }
  }

  const issues: string[] = []
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    issues.push("The IBAN structure is invalid. It must start with a country code and two check digits.")
  }
  if (iban.length !== 22) {
    issues.push(`${expected} IBANs must be 22 characters. This value has ${iban.length}.`)
  }
  const prefix = iban.slice(0, 2)
  if (/^[A-Z]{2}/.test(prefix) && prefix !== expected) {
    issues.push(`The IBAN country prefix is ${prefix}, but ${country} accounts must start with ${expected}.`)
  }

  if (issues.length === 0) {
    const remainder = ibanMod97(iban)
    if (remainder !== 1) {
      issues.push(`The IBAN checksum failed the mod-97 test (remainder ${remainder}, expected 1).`)
    } else {
      const countryLabel = country === "United Kingdom" ? "the United Kingdom" : country
      return {
        status: "pass",
        result: `Bank details are valid for ${countryLabel}.`,
        detail: `IBAN ${iban} has the ${expected} prefix, is 22 characters, and the mod-97 checksum equals 1.`,
        actionItems: [],
      }
    }
  }

  return {
    status: "fail",
    result: issues[0] ?? "IBAN is invalid.",
    detail: issues.join(" "),
    actionItems: [
      `The bank account value "${accountNumber.trim()}" is not a valid ${country} IBAN. Send an IBAN starting with ${expected} that passes the checksum, then resubmit.`,
    ],
  }
}
