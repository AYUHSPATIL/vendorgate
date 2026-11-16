import { type Submission } from "../lib/types.ts"

export interface Preset {
  id: string
  label: string
  description: string
  submission: Submission
}

const allDocuments = {
  businessRegistration: true,
  taxRegistration: true,
  bankProof: true,
}

export const PRESETS: Preset[] = [
  {
    id: "happy",
    label: "Happy path — clean vendor",
    description: "Complete India vendor, matching bank name, and all three documents.",
    submission: {
      companyName: "Acme Industrial Supplies Pvt Ltd",
      country: "India",
      taxId: "27AABCA1234F1Z5",
      bankHolder: "Acme Industrial Supplies Pvt Ltd",
      accountNumber: "50100234567890",
      ifsc: "HDFC0001234",
      email: "accounts@acmeindustrial.in",
      documents: { ...allDocuments },
    },
  },
  {
    id: "edge1",
    label: "Edge 1 — formatting-only name",
    description: "The bank holder differs only by punctuation, case, and legal-suffix spelling.",
    submission: {
      companyName: "Brightwave Technologies Private Limited",
      country: "India",
      taxId: "29AABCB5678K1Z2",
      bankHolder: "BRIGHTWAVE TECHNOLOGIES PVT. LTD.",
      accountNumber: "60200345678901",
      ifsc: "ICIC0004567",
      email: "finance@brightwave.in",
      documents: { ...allDocuments },
    },
  },
  {
    id: "edge2",
    label: "Edge 2 — wrong tax ID",
    description: "Country is India, but the tax ID is a US EIN.",
    submission: {
      companyName: "Northstar Logistics LLC",
      country: "India",
      taxId: "12-3456789",
      bankHolder: "Northstar Logistics LLC",
      accountNumber: "70300456789012",
      ifsc: "SBIN0007890",
      email: "ops@northstarlogistics.com",
      documents: { ...allDocuments },
    },
  },
  {
    id: "edge3",
    label: "Edge 3 — missing documents",
    description: "German vendor with only the business registration certificate attached.",
    submission: {
      companyName: "Helvetica Parts GmbH",
      country: "Germany",
      taxId: "DE123456789",
      bankHolder: "Helvetica Parts GmbH",
      accountNumber: "DE89370400440532013000",
      ifsc: "",
      email: "billing@helveticaparts.de",
      documents: {
        businessRegistration: true,
        taxRegistration: false,
        bankProof: false,
      },
    },
  },
  {
    id: "edge4",
    label: "Edge 4 — shared bank account",
    description: "This UK IBAN is already registered to Pennine Office Supplies Ltd.",
    submission: {
      companyName: "Zenith Trading Co",
      country: "United Kingdom",
      taxId: "GB123456789",
      bankHolder: "Zenith Trading Co",
      accountNumber: "GB82WEST12345698765432",
      ifsc: "",
      email: "pay@zenithtrading.co.uk",
      documents: { ...allDocuments },
    },
  },
  {
    id: "edge5",
    label: "Edge 5 — name mismatch",
    description: "The US company name and the bank account holder are different.",
    submission: {
      companyName: "Orion Consulting Inc",
      country: "United States",
      taxId: "84-1234567",
      bankHolder: "Michael R. Daniels",
      accountNumber: "000123456789",
      ifsc: "",
      email: "orion@orionconsulting.com",
      documents: { ...allDocuments },
    },
  },
]
