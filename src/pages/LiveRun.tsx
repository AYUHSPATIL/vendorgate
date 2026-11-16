import {
  Circle,
  CircleCheck,
  CircleX,
  Copy,
  LoaderCircle,
  TriangleExclamationPoint,
} from "lucide-react"
import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { stageStatusLabel, StatusBadge } from "../components/StatusBadge.tsx"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion.tsx"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { useReview } from "../context/ReviewContext.tsx"
import { RULE_EXPLANATION } from "../lib/pipeline.ts"
import type { StageStatus } from "../lib/types.ts"
import { copyText, formatElapsed, formatTimestamp } from "../lib/utils.ts"

const DOCUMENTS = [
  ["businessRegistration", "Business registration certificate"],
  ["taxRegistration", "Tax registration certificate"],
  ["bankProof", "Bank proof (cancelled cheque / statement)"],
] as const

function StageIcon({ status }: { status: StageStatus }) {
  const label = stageStatusLabel(status)
  if (status === "running") return <LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" aria-label={label} />
  if (status === "pass") return <CircleCheck className="h-6 w-6 text-green-600" aria-label={label} />
  if (status === "warn") return <TriangleExclamationPoint className="h-6 w-6 text-amber-500" aria-label={label} />
  if (status === "fail") return <CircleX className="h-6 w-6 text-red-600" aria-label={label} />
  return <Circle className="h-6 w-6 text-slate-300" aria-label={label} />
}

function stageBorder(status: StageStatus): string {
  switch (status) {
    case "pass":
      return "border-l-green-500"
    case "warn":
      return "border-l-amber-500"
    case "fail":
      return "border-l-red-500"
    case "running":
      return "border-l-indigo-500"
    default:
      return "border-l-slate-200"
  }
}

export function LiveRun() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { runs, isRunning, approveManually, rejectManually } = useReview()
  const run = id ? runs.find((item) => item.id === id) : undefined

  useEffect(() => {
    document.title = run ? `${run.id} · VendorGate` : "Live run · VendorGate"
  }, [run])

  if (!run) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{id ? "Review not found" : "No review is open"}</CardTitle>
          <CardDescription>
            {id
              ? `${id} is not stored in this browser.`
              : "Submit a vendor to watch the six stages, or open a completed review from the dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/">New submission</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const submission = run.submission
  const finishedCount = run.stages.filter((stage) => stage.status === "pass" || stage.status === "warn" || stage.status === "fail").length
  const active = run.stages.some((stage) => stage.status === "running")
  const progress = Math.min(100, ((finishedCount + (active ? 0.45 : 0)) / run.stages.length) * 100)
  const openDetails = run.stages
    .filter((stage) => stage.status === "warn" || stage.status === "fail" || (run.decision !== "RUNNING" && stage.name === "Name consistency"))
    .map((stage) => stage.name)
  const done = run.decision !== "RUNNING"
  const headline =
    run.decision === "APPROVED"
      ? "Vendor approved"
      : run.decision === "PENDING"
        ? "Waiting on review"
        : run.decision === "REJECTED"
          ? "Vendor rejected"
          : run.decision === "FAILED"
            ? "Review failed"
            : "Review in progress"

  async function onCopy() {
    if (!run?.email) return
    try {
      await copyText(`To: ${run.email.to}\nSubject: ${run.email.subject}\n\n${run.email.body}`)
      toast.success("Email copied to clipboard")
    } catch (error) {
      console.error(error)
      toast.error("Could not copy the email. Select the text and copy it manually.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-700">{run.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{headline}</h1>
          <p className="mt-1 text-sm text-slate-500">{formatTimestamp(run.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isRunning} onClick={() => navigate("/")}>
            Run another
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
            View in dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Submission</CardTitle>
            <CardDescription>{submission.companyName || "Unnamed vendor"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow label="Country" value={submission.country || "—"} />
            <SummaryRow label="Tax ID" value={submission.taxId || "—"} />
            <SummaryRow label="Account holder" value={submission.bankHolder || "—"} />
            <SummaryRow label="Account / IBAN" value={submission.accountNumber || "—"} />
            {submission.country === "India" ? <SummaryRow label="IFSC" value={submission.ifsc || "—"} /> : null}
            <SummaryRow label="Email" value={submission.email || "—"} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Documents</p>
              <ul className="mt-2 space-y-1.5">
                {DOCUMENTS.map(([key, label]) => {
                  const attached = submission.documents[key]
                  return (
                    <li key={key} className="flex items-start gap-2 text-slate-700">
                      {attached ? (
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      ) : (
                        <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                      )}
                      <span>{label}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {done ? "Review complete" : `Stage ${Math.min(finishedCount + 1, 6)} of 6`}
              </span>
              <span className="text-slate-500">{finishedCount} / 6 checks finished</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <ol className="space-y-3" aria-live="polite">
            {run.stages.map((stage, index) => (
              <li key={stage.name} className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${stageBorder(stage.status)}`}>
                <div className="flex items-start gap-3">
                  <StageIcon status={stage.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-medium text-slate-900">
                        Stage {index + 1}: {stage.name}
                      </h2>
                      <span className="text-xs text-slate-500">{formatElapsed(stage.elapsedMs, stage.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{stage.result}</p>
                    {stage.detail ? (
                      <Accordion
                        type="multiple"
                        key={`${run.id}-${run.decision}-${stage.name}`}
                        defaultValue={openDetails.includes(stage.name) ? [stage.name] : []}
                      >
                        <AccordionItem value={stage.name}>
                          <AccordionTrigger>Details</AccordionTrigger>
                          <AccordionContent>
                            <p className="whitespace-pre-wrap">{stage.detail}</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {done ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge decision={run.decision} className="px-3 py-1 text-sm" />
                  <CardTitle>{headline}</CardTitle>
                </div>
                <CardDescription>{run.topReason}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {run.escalate && run.decision === "PENDING" ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                    Escalated to human reviewer
                  </p>
                ) : null}
                {run.escalate && run.decision !== "PENDING" ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    This run was flagged for human review during screening.
                  </p>
                ) : null}
                {run.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{run.error}</p> : null}
                {run.reasoning.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Reasoning</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                      {run.reasoning.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{RULE_EXPLANATION}</p>
                {run.decision === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => approveManually(run.id)}>
                      Approve manually
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => rejectManually(run.id)}>
                      Reject manually
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {run.internalNotes.length > 0 ? (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle>Internal note</CardTitle>
                <CardDescription>Shown to reviewers only. This is not included in the vendor email.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {run.internalNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {run.email ? (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Email to the vendor</CardTitle>
                  <CardDescription>To {run.email.to || "the contact on the submission"}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {run.email.source}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void onCopy()}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy email
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium text-slate-900">Subject: {run.email.subject}</p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                  {run.email.body}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {done && !run.email && run.decision === "APPROVED" ? (
            <Card>
              <CardHeader>
                <CardTitle>No vendor email</CardTitle>
                <CardDescription>The submission was approved, so nothing needs to be sent back.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
              <CardDescription>Every status change on this run.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {run.auditLog.map((entry, index) => (
                  <li key={`${entry.timestamp}-${entry.action}-${index}`} className="border-l-2 border-indigo-200 pl-3">
                    <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                    <p className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</p>
                    <p className="mt-1 text-sm text-slate-700">{entry.note}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 break-all text-slate-800">{value}</p>
    </div>
  )
}
