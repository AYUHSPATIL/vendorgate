import { useEffect, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { SEED_VENDORS } from "../data/seedVendors.ts"
import { useReview } from "../context/ReviewContext.tsx"
import { NAME_PASS_THRESHOLD, NAME_REVIEW_THRESHOLD } from "../lib/fuzzy.ts"
import { RULE_EXPLANATION } from "../lib/pipeline.ts"
import { STAGE_NAMES } from "../lib/types.ts"
import { IFSC_PATTERN, TAX_RULES } from "../lib/validators.ts"

const TOC = [
  ["stages", "Six stages"],
  ["thresholds", "Thresholds"],
  ["tax-ids", "Tax ID formats"],
  ["bank", "Bank rules"],
  ["names", "Name matching"],
  ["screening", "Duplicate and fraud"],
  ["decision", "Decision priority"],
  ["vendors", "Vendor database"],
  ["design", "Design choices"],
  ["assumptions", "Assumptions"],
  ["next", "What I would build next"],
] as const

export function Assumptions() {
  const { hydrated, vendors } = useReview()

  useEffect(() => {
    document.title = "Assumptions and rules · VendorGate"
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Assumptions and rules</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          VendorGate explains every decision from the rules below. The same functions that run in a review are the
          source of these thresholds and formats.
        </p>
      </div>

      <nav className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="On this page">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="font-medium text-indigo-700 hover:text-indigo-900">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="stages" title="The six stages">
        <ol className="list-decimal space-y-2 pl-5">
          {STAGE_NAMES.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ol>
        <p>
          Each stage returns pass, warning, or fail, plus a one-line result and a detail string. The screen waits about
          700ms between stages so the status can move from waiting, to a spinner, to the result. The elapsed time on
          each card is the check itself, not that pause.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Completeness warns with the exact missing items. It requires the company name, country, tax ID, bank holder, account number, a valid contact email, an IFSC for India, and all three documents.</li>
          <li>Tax ID format fails when a value is present but does not match the selected country. An empty tax ID stays a warning.</li>
          <li>Bank details fail when a value is present but malformed. Missing bank fields stay a warning.</li>
          <li>Name consistency compares the company legal name with the bank account holder.</li>
          <li>Duplicate and fraud screening compares the submission with the vendor database.</li>
          <li>Decision and communication applies the priority order and, when needed, drafts the vendor email.</li>
        </ul>
      </Section>

      <Section id="thresholds" title="Thresholds">
        <ul className="list-disc space-y-2 pl-5">
          <li>Name score at or above {NAME_PASS_THRESHOLD.toFixed(2)} passes: the names match after normalization.</li>
          <li>Name score from {NAME_REVIEW_THRESHOLD.toFixed(2)} up to but not including {NAME_PASS_THRESHOLD.toFixed(2)} warns and needs a person.</li>
          <li>Name score below {NAME_REVIEW_THRESHOLD.toFixed(2)} fails. The result states that the account holder does not match the registered company and flags possible payment diversion risk.</li>
        </ul>
        <p>The score is the average of token-set Jaccard similarity and normalized Levenshtein similarity. Both normalized names and the score are stored in the stage detail.</p>
      </Section>

      <Section id="tax-ids" title="Tax ID formats">
        <p>Values are trimmed and uppercased before the test. If a value misses the selected country but matches another supported country, the reason says so.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Country</th>
                <th className="py-2 pr-3 font-medium">Format</th>
                <th className="py-2 pr-3 font-medium">Example</th>
                <th className="py-2 font-medium">Pattern</th>
              </tr>
            </thead>
            <tbody>
              {TAX_RULES.map((rule) => (
                <tr key={rule.country} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">{rule.country}</td>
                  <td className="py-2 pr-3">{rule.shortName}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{rule.example}</td>
                  <td className="py-2 font-mono text-xs">{rule.regex.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="bank" title="Bank rules">
        <ul className="list-disc space-y-2 pl-5">
          <li>India: IFSC must match {IFSC_PATTERN.source}, and the account number must be 9 to 18 digits.</li>
          <li>United States: the account number must be 8 to 17 digits. No IFSC is required.</li>
          <li>United Kingdom: the value is an IBAN. The prefix must be GB, the length must be 22, and the mod-97 checksum must equal 1.</li>
          <li>Germany: the value is an IBAN. The prefix must be DE, the length must be 22, and the mod-97 checksum must equal 1.</li>
        </ul>
        <p>
          The checksum moves the first four characters to the end, converts letters to numbers (A = 10 through Z = 35),
          and computes the remainder mod 97 one digit at a time so the number never overflows. A valid IBAN leaves a
          remainder of 1.
        </p>
      </Section>

      <Section id="names" title="Name matching">
        <p>
          Both names are lowercased. Punctuation becomes spaces. Extra spaces collapse. Trailing legal suffixes are
          removed: pvt, private, ltd, limited, llc, inc, incorporated, gmbh, co, corp, corporation, company, plc, and
          llp. “Private Limited” and “PVT. LTD.” therefore become the same tokens.
        </p>
      </Section>

      <Section id="screening" title="Duplicate and fraud screening">
        <ul className="list-disc space-y-2 pl-5">
          <li>The same bank account as a different vendor name warns with “POSSIBLE FRAUD - bank account already registered to [vendor]” and sets escalate.</li>
          <li>The same tax ID as an existing vendor warns with “Duplicate vendor: tax ID already registered to [vendor]”.</li>
          <li>The same bank account and the same normalized name warns as a duplicate registration.</li>
          <li>Otherwise the stage passes.</li>
        </ul>
        <p>
          Escalation is shown only when the final decision is pending. For that case the vendor email does not reveal
          the fraud suspicion. It only asks for a bank confirmation letter on bank letterhead. The internal note keeps
          the real reason.
        </p>
      </Section>

      <Section id="decision" title="Decision priority">
        <ol className="list-decimal space-y-2 pl-5">
          <li>If tax ID format, bank details, or name consistency fails, the decision is rejected.</li>
          <li>Otherwise, if any stage warns, the decision is pending. When the fraud flag is set, it is marked “Escalated to human reviewer”.</li>
          <li>Otherwise the decision is approved and the vendor is added to the database.</li>
        </ol>
        <p>{RULE_EXPLANATION}</p>
        <p>
          Pending and rejected runs get an email to the contact address. The draft lists the action items. Approved
          runs do not get an email. A reviewer can later approve or reject a pending run; approval adds the vendor and
          writes an audit entry.
        </p>
      </Section>

      <Section id="vendors" title="Existing vendor database">
        <p>These three vendors are the hardcoded seed. They are also the starting database in an empty browser.</p>
        <VendorTable vendors={SEED_VENDORS} />
        <h3 className="text-base font-semibold text-slate-900">Vendors currently stored in this browser</h3>
        <p>
          {hydrated
            ? "Approved submissions are appended here and used for the next duplicate check."
            : "Loading the stored vendor list…"}
        </p>
        {hydrated ? <VendorTable vendors={vendors} /> : null}
        {hydrated && vendors.length === SEED_VENDORS.length ? (
          <p>No approved vendors have been added in this browser yet.</p>
        ) : null}
      </Section>

      <Section id="design" title="Design choices">
        <p>
          Deterministic rules for validation and fraud checks so decisions are explainable and auditable; AI only used
          for drafting vendor emails.
        </p>
        <p>
          The email step calls a Supabase edge function only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
          configured. If that call is missing, fails, or takes longer than five seconds, the built-in template writes
          the same action items. The email is tagged “AI-drafted” or “Template” and is never left empty.
        </p>
      </Section>

      <Section id="assumptions" title="Assumptions">
        <ul className="list-disc space-y-2 pl-5">
          <li>GSTIN checksum is not verified. Only the format is checked.</li>
          <li>There are no real government API lookups.</li>
          <li>Supported countries are limited to India, the United States, the United Kingdom, and Germany.</li>
          <li>Documents are represented as checkboxes rather than uploaded files.</li>
          <li>UK and Germany bank values are IBANs. US values are plain account numbers. India uses an account number plus IFSC.</li>
          <li>Runs, the growing vendor list, and the next run number are stored in this browser with localStorage. Every read and write is guarded so a storage failure does not blank the app.</li>
        </ul>
      </Section>

      <Section id="next" title="What I would build next">
        <ul className="list-disc space-y-2 pl-5">
          <li>OCR on uploaded documents.</li>
          <li>Sanctions-list screening.</li>
          <li>Real registry lookups.</li>
          <li>Email sending, not only drafting.</li>
          <li>An approval workflow with named reviewers and assignments.</li>
        </ul>
        <p>
          <Link to="/" className="font-medium text-indigo-700 hover:text-indigo-900">
            Start a submission
          </Link>
          {" · "}
          <Link to="/dashboard" className="font-medium text-indigo-700 hover:text-indigo-900">
            Open the dashboard
          </Link>
        </p>
      </Section>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

function VendorTable({ vendors }: { vendors: readonly { name: string; country: string; taxId: string; accountNumber: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Vendor</th>
            <th className="py-2 pr-3 font-medium">Country</th>
            <th className="py-2 pr-3 font-medium">Tax ID</th>
            <th className="py-2 font-medium">Account</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={`${vendor.name}-${vendor.accountNumber}`} className="border-b border-slate-100">
              <td className="py-2 pr-3">{vendor.name}</td>
              <td className="py-2 pr-3">{vendor.country}</td>
              <td className="py-2 pr-3 font-mono text-xs">{vendor.taxId}</td>
              <td className="py-2 font-mono text-xs">{vendor.accountNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
