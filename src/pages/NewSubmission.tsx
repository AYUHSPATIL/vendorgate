import { LoaderCircle } from "lucide-react"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { Checkbox } from "../components/ui/checkbox.tsx"
import { Input } from "../components/ui/input.tsx"
import { Label } from "../components/ui/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx"
import { PRESETS } from "../data/presets.ts"
import { useReview } from "../context/ReviewContext.tsx"
import { COUNTRIES, EMPTY_SUBMISSION, isCountry, type Submission } from "../lib/types.ts"
import { bankHint, isValidEmail, taxHint } from "../lib/validators.ts"

const DOCUMENT_FIELDS = [
  { key: "businessRegistration", label: "Business registration certificate" },
  { key: "taxRegistration", label: "Tax registration certificate" },
  { key: "bankProof", label: "Bank proof (cancelled cheque / statement)" },
] as const

function formErrors(submission: Submission): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!submission.companyName.trim()) errors.companyName = "Company legal name is required."
  if (!submission.country) errors.country = "Country is required."
  if (submission.email.trim() && !isValidEmail(submission.email)) {
    errors.email = "Enter a valid email address, like accounts@vendor.com."
  }
  return errors
}

export function NewSubmission() {
  const navigate = useNavigate()
  const { hydrated, isRunning, startRun } = useReview()
  const [submission, setSubmission] = useState<Submission>(EMPTY_SUBMISSION)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const preset = PRESETS.find((item) => item.id === presetId)

  useEffect(() => {
    document.title = "New submission · VendorGate"
  }, [])

  function update<K extends keyof Submission>(key: K, value: Submission[K]) {
    setSubmission((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function loadPreset(id: string) {
    const next = PRESETS.find((item) => item.id === id)
    if (!next) return
    setSubmission({
      ...next.submission,
      documents: { ...next.submission.documents },
    })
    setPresetId(id)
    setErrors({})
  }

  function clearForm() {
    setSubmission(EMPTY_SUBMISSION)
    setPresetId(null)
    setErrors({})
  }

  function onCountry(value: string) {
    if (!isCountry(value)) return
    setSubmission((current) => ({
      ...current,
      country: value,
      ifsc: value === "India" ? current.ifsc : "",
    }))
    setErrors((current) => {
      if (!current.country) return current
      const next = { ...current }
      delete next.country
      return next
    })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = formErrors(submission)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Add the company name and a valid setup before running a review.")
      return
    }
    if (!hydrated) {
      toast.error("Saved reviews are still loading. Try again in a moment.")
      return
    }
    const id = startRun(submission)
    if (!id) {
      toast.error("A review is already running. Open Live Run to watch it.")
      return
    }
    navigate(`/run/${id}`)
  }

  const locked = isRunning || !hydrated

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">New submission</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Load a test scenario or enter a vendor. Run Review checks completeness, tax ID, bank details, name
          consistency, and duplicates, then records a decision.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Load test scenario</CardTitle>
          <CardDescription>These buttons fill the form. They do not skip the review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={presetId === item.id ? "default" : "outline"}
                disabled={locked}
                onClick={() => loadPreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={clearForm}>
              Clear
            </Button>
          </div>
          {preset ? <p className="text-sm text-slate-600">{preset.description}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Company name and country are required to start. Other gaps are reported by the review.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit} noValidate autoComplete="off">
            <Field label="Company legal name" htmlFor="companyName" required error={errors.companyName}>
              <Input
                id="companyName"
                value={submission.companyName}
                disabled={locked}
                aria-invalid={Boolean(errors.companyName)}
                onChange={(event) => update("companyName", event.target.value)}
              />
            </Field>

            <Field label="Country" htmlFor="country" required error={errors.country}>
              <Select value={submission.country || undefined} onValueChange={onCountry} disabled={locked}>
                <SelectTrigger id="country" aria-invalid={Boolean(errors.country)}>
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tax ID" htmlFor="taxId" hint={taxHint(submission.country)}>
              <Input
                id="taxId"
                value={submission.taxId}
                disabled={locked}
                onChange={(event) => update("taxId", event.target.value)}
              />
            </Field>

            <Field label="Bank account holder name" htmlFor="bankHolder">
              <Input
                id="bankHolder"
                value={submission.bankHolder}
                disabled={locked}
                onChange={(event) => update("bankHolder", event.target.value)}
              />
            </Field>

            <Field label="Bank account number / IBAN" htmlFor="accountNumber" hint={bankHint(submission.country)}>
              <Input
                id="accountNumber"
                value={submission.accountNumber}
                disabled={locked}
                onChange={(event) => update("accountNumber", event.target.value)}
              />
            </Field>

            {submission.country === "India" ? (
              <Field label="IFSC code" htmlFor="ifsc" hint="4 letters, a 0, then 6 letters or digits. Example: HDFC0001234.">
                <Input
                  id="ifsc"
                  value={submission.ifsc}
                  disabled={locked}
                  onChange={(event) => update("ifsc", event.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Contact email" htmlFor="email" error={errors.email}>
              <Input
                id="email"
                type="email"
                value={submission.email}
                disabled={locked}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => update("email", event.target.value)}
              />
            </Field>

            <fieldset className="space-y-3" disabled={locked}>
              <legend className="text-sm font-medium text-slate-800">Documents attached</legend>
              {DOCUMENT_FIELDS.map((document) => {
                const id = `doc-${document.key}`
                return (
                  <label key={document.key} htmlFor={id} className="flex items-start gap-3 text-sm text-slate-700">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={submission.documents[document.key]}
                      onCheckedChange={(checked) =>
                        setSubmission((current) => ({
                          ...current,
                          documents: { ...current.documents, [document.key]: checked === true },
                        }))
                      }
                    />
                    <span>{document.label}</span>
                  </label>
                )
              })}
            </fieldset>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {isRunning ? "A review is already running." : "The six stages run one after another."}
              </p>
              <Button type="submit" disabled={locked}>
                {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isRunning ? "Review in progress" : "Run Review"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  )
}
