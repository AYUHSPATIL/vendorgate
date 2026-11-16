import { PRESETS } from "../src/data/presets.ts"
import { cloneSeedVendors } from "../src/data/seedVendors.ts"
import { buildTemplateEmail, draftVendorEmail } from "../src/lib/emailTemplate.ts"
import { runStages } from "../src/lib/pipeline.ts"
import { appendVendor } from "../src/lib/storage.ts"
import { ibanMod97 } from "../src/lib/validators.ts"

const failures: string[] = []

function expect(condition: boolean, message: string) {
  if (!condition) failures.push(message)
}

const happy = PRESETS.find((preset) => preset.id === "happy")
const edge1 = PRESETS.find((preset) => preset.id === "edge1")
const edge2 = PRESETS.find((preset) => preset.id === "edge2")
const edge3 = PRESETS.find((preset) => preset.id === "edge3")
const edge4 = PRESETS.find((preset) => preset.id === "edge4")
const edge5 = PRESETS.find((preset) => preset.id === "edge5")

if (!happy || !edge1 || !edge2 || !edge3 || !edge4 || !edge5) {
  throw new Error("Missing presets")
}

const seed = cloneSeedVendors()
const results = [happy, edge1, edge2, edge3, edge4, edge5].map((preset) => ({
  preset,
  review: runStages(preset.submission, seed),
}))

for (const { preset, review } of results) {
  console.log(
    [
      preset.id,
      review.decision,
      review.escalate ? "escalated" : "not-escalated",
      `score-stage=${review.outcomes[3]?.result ?? ""}`,
      `top=${review.topReason}`,
    ].join(" | "),
  )
}

const byId = Object.fromEntries(results.map((item) => [item.preset.id, item.review]))
const happyReview = byId.happy
const edge1Review = byId.edge1
const edge2Review = byId.edge2
const edge3Review = byId.edge3
const edge4Review = byId.edge4
const edge5Review = byId.edge5

if (!happyReview || !edge1Review || !edge2Review || !edge3Review || !edge4Review || !edge5Review) {
  throw new Error("Missing reviews")
}

expect(happyReview.decision === "APPROVED" && !happyReview.escalate, "Happy path should be approved")
expect(Boolean(happyReview.vendorToAdd), "Happy path should add a vendor")
expect(edge1Review.decision === "APPROVED" && edge1Review.outcomes[3]?.status === "pass", "Edge 1 should pass name matching and be approved")
expect((edge1Review.outcomes[3]?.detail ?? "").includes("brightwave technologies"), "Edge 1 should normalize both names to brightwave technologies")
expect(edge2Review.decision === "REJECTED", "Edge 2 should be rejected")
expect((edge2Review.outcomes[1]?.result ?? "").includes("Value looks like a US EIN but country is India"), "Edge 2 should identify the US EIN")
expect(edge3Review.decision === "PENDING" && !edge3Review.escalate, "Edge 3 should be pending and not escalated")
expect(edge3Review.outcomes[0]?.result === "Missing: Tax registration certificate, Bank proof", "Edge 3 missing list mismatch")
expect(edge4Review.decision === "PENDING" && edge4Review.escalate, "Edge 4 should be pending and escalated")
expect((edge4Review.topReason ?? "").includes("POSSIBLE FRAUD - bank account already registered to Pennine Office Supplies Ltd"), "Edge 4 fraud flag mismatch")
expect(edge5Review.decision === "REJECTED", "Edge 5 should be rejected")
expect(
  (edge5Review.outcomes[3]?.result ?? "").includes("Account holder does not match the registered company, possible payment diversion risk"),
  "Edge 5 name failure text mismatch",
)
expect((edge5Review.outcomes[3]?.status ?? "") === "fail", "Edge 5 name stage should fail")

const edge3Email = buildTemplateEmail({
  to: edge3.submission.email,
  companyName: edge3.submission.companyName,
  decision: "PENDING",
  actionItems: edge3Review.actionItems,
  escalated: false,
  forbiddenPhrases: [],
})
expect(edge3Email.body.includes("tax registration certificate"), "Edge 3 email should list the tax certificate")
expect(edge3Email.body.toLowerCase().includes("bank proof"), "Edge 3 email should list bank proof")
expect(edge3Review.actionItems.length === 2, `Edge 3 should have 2 action items, got ${edge3Review.actionItems.length}: ${edge3Review.actionItems.join(" || ")}`)

const edge4Email = buildTemplateEmail({
  to: edge4.submission.email,
  companyName: edge4.submission.companyName,
  decision: "PENDING",
  actionItems: edge4Review.actionItems,
  escalated: true,
  forbiddenPhrases: edge4Review.internalNotes,
})
const edge4Text = `${edge4Email.subject}\n${edge4Email.body}`.toLowerCase()
expect(edge4Text.includes("bank confirmation letter"), "Edge 4 email should ask for a bank confirmation letter")
expect(!edge4Text.includes("fraud"), "Edge 4 email must not say fraud")
expect(!edge4Text.includes("pennine"), "Edge 4 email must not name Pennine")
expect(edge4Email.source === "Template", "Template tag missing")

const second = runStages(happy.submission, appendVendor(seed, happyReview.vendorToAdd ?? seed[0]!))
expect(second.decision === "PENDING" && !second.escalate, "A second identical approval should be a duplicate warning, not fraud")

expect(ibanMod97("DE89370400440532013000") === 1, "German example IBAN checksum failed")
expect(ibanMod97("GB82WEST12345698765432") === 1, "UK example IBAN checksum failed")
expect(ibanMod97("DE89370400440532013001") !== 1, "Broken German IBAN should fail checksum")

const aiFallback = await draftVendorEmail({
  to: edge4.submission.email,
  companyName: edge4.submission.companyName,
  decision: "PENDING",
  actionItems: edge4Review.actionItems,
  escalated: true,
  forbiddenPhrases: edge4Review.internalNotes,
})
expect(aiFallback.source === "Template", "Unconfigured AI should fall back to the template")
expect(!aiFallback.body.toLowerCase().includes("pennine"), "Fallback email leaked the other vendor")

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log("All preset checks passed")
