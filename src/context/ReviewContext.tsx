import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { draftVendorEmail } from "../lib/emailTemplate.ts"
import { runStages } from "../lib/pipeline.ts"
import {
  appendVendor,
  defaultState,
  formatRunId,
  loadState,
  saveState,
  vendorFromSubmission,
  type PersistedState,
} from "../lib/storage.ts"
import { createPendingStages, type Run, type Submission, type Vendor } from "../lib/types.ts"

const STAGE_DELAY_MS = 700

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

interface ReviewContextValue {
  hydrated: boolean
  runs: Run[]
  vendors: Vendor[]
  isRunning: boolean
  startRun: (submission: Submission) => string | null
  approveManually: (id: string) => void
  rejectManually: (id: string) => void
  clearHistory: () => void
}

const ReviewContext = createContext<ReviewContextValue | null>(null)

function withStage(run: Run, index: number, patch: Partial<Run["stages"][number]>): Run {
  return {
    ...run,
    stages: run.stages.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...patch } : stage)),
  }
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PersistedState | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const lock = useRef(false)
  const saveWarned = useRef(false)
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    try {
      setStore(loadState())
    } catch (error) {
      console.error(error)
      setStore(defaultState())
      toast.error("Saved reviews could not be read. Starting from the seed vendor list.")
    }
  }, [])

  useEffect(() => {
    if (!store) return
    const saved = saveState(store)
    if (!saved && !saveWarned.current) {
      saveWarned.current = true
      toast.error("Could not save VendorGate data in this browser.")
    }
    if (saved) saveWarned.current = false
  }, [store])

  const updateRun = useCallback((id: string, updater: (run: Run) => Run) => {
    setStore((current) => {
      if (!current || !current.runs.some((run) => run.id === id)) return current
      return {
        ...current,
        runs: current.runs.map((run) => (run.id === id ? updater(run) : run)),
      }
    })
  }, [])

  const startRun = useCallback(
    (submission: Submission): string | null => {
      const current = storeRef.current
      if (!current || lock.current) return null
      lock.current = true
      setIsRunning(true)
      const id = formatRunId(current.nextNumber)
      const now = new Date().toISOString()
      const vendors = current.vendors.map((vendor) => ({ ...vendor }))
      const run: Run = {
        id,
        createdAt: now,
        submission,
        stages: createPendingStages(),
        decision: "RUNNING",
        escalate: false,
        reasoning: [],
        topReason: "Review in progress",
        internalNotes: [],
        email: null,
        auditLog: [
          {
            timestamp: now,
            action: "Submitted",
            note: "Vendor submission received and the review started.",
          },
        ],
      }
      setStore((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          nextNumber: previous.nextNumber + 1,
          runs: [run, ...previous.runs],
        }
      })
      void animateReview(id, submission, vendors)
      return id
    },
    [updateRun],
  )

  async function animateReview(id: string, submission: Submission, vendors: Vendor[]) {
    try {
      await delay(300)
      const review = runStages(submission, vendors)
      for (let index = 0; index < review.outcomes.length; index += 1) {
        const outcome = review.outcomes[index]
        if (!outcome) throw new Error("A stage result was missing.")
        updateRun(id, (run) =>
          withStage(run, index, { status: "running", result: "Running check…", detail: "", elapsedMs: null }),
        )
        await delay(STAGE_DELAY_MS)
        const isLast = index === review.outcomes.length - 1
        if (!isLast) {
          updateRun(id, (run) =>
            withStage(run, index, {
              status: outcome.status,
              result: outcome.result,
              detail: outcome.detail,
              elapsedMs: outcome.elapsedMs,
            }),
          )
          continue
        }

        const emailStarted = performance.now()
        const email =
          review.decision === "PENDING" || review.decision === "REJECTED"
            ? await draftVendorEmail({
                to: submission.email.trim(),
                companyName: submission.companyName.trim() || "Vendor",
                decision: review.decision,
                actionItems: review.actionItems,
                escalated: review.escalate,
                forbiddenPhrases: review.internalNotes,
              })
            : null
        const emailMs = performance.now() - emailStarted
        const finishedAt = new Date().toISOString()
        setStore((current) => {
          if (!current || !current.runs.some((item) => item.id === id)) return current
          return {
            ...current,
            vendors: review.vendorToAdd ? appendVendor(current.vendors, review.vendorToAdd) : current.vendors,
            runs: current.runs.map((run) => {
              if (run.id !== id) return run
              return {
                ...withStage(run, index, {
                  status: outcome.status,
                  result: outcome.result,
                  detail: outcome.detail,
                  elapsedMs: outcome.elapsedMs + emailMs,
                }),
                decision: review.decision,
                escalate: review.escalate,
                reasoning: review.reasoning,
                topReason: review.topReason,
                internalNotes: review.internalNotes,
                email,
                auditLog: [
                  ...run.auditLog,
                  {
                    timestamp: finishedAt,
                    action: "Decision recorded",
                    note: `${review.decision}${review.escalate ? " — escalated to human reviewer" : ""}. ${review.topReason}${email ? ` Email source: ${email.source}.` : ""}`,
                  },
                ],
              }
            }),
          }
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      console.error("VendorGate review failed", error)
      toast.error("Something went wrong during the review. This run was marked as failed.")
      const failedAt = new Date().toISOString()
      updateRun(id, (run) => ({
        ...run,
        decision: "FAILED",
        topReason: message,
        error: message,
        stages: run.stages.map((stage) =>
          stage.status === "pending" || stage.status === "running"
            ? {
                ...stage,
                status: "fail",
                result: "Review stopped because of an unexpected error.",
                detail: message,
              }
            : stage,
        ),
        auditLog: [...run.auditLog, { timestamp: failedAt, action: "Run failed", note: message }],
      }))
    } finally {
      lock.current = false
      setIsRunning(false)
    }
  }

  const approveManually = useCallback((id: string) => {
    const run = storeRef.current?.runs.find((item) => item.id === id)
    if (!run || run.decision !== "PENDING") {
      toast.error("Only a pending review can be approved manually.")
      return
    }
    const vendor = vendorFromSubmission(run.submission)
    const timestamp = new Date().toISOString()
    setStore((current) => {
      if (!current) return current
      const latest = current.runs.find((item) => item.id === id)
      if (!latest || latest.decision !== "PENDING") return current
      return {
        ...current,
        vendors: vendor ? appendVendor(current.vendors, vendor) : current.vendors,
        runs: current.runs.map((item) =>
          item.id === id
            ? {
                ...withStage(item, 5, {
                  status: "pass",
                  result: "Manually approved by a reviewer.",
                }),
                decision: "APPROVED",
                topReason: "Manually approved by a reviewer",
                reasoning: [...item.reasoning, "A reviewer manually approved this pending submission."],
                auditLog: [
                  ...item.auditLog,
                  {
                    timestamp,
                    action: "Manual approval",
                    note: vendor
                      ? "Reviewer approved this pending submission. The vendor was added to the database."
                      : "Reviewer approved this pending submission.",
                  },
                ],
              }
            : item,
        ),
      }
    })
    toast.success(vendor ? "Approved manually. The vendor was added to the database." : "Approved manually.")
  }, [])

  const rejectManually = useCallback((id: string) => {
    const run = storeRef.current?.runs.find((item) => item.id === id)
    if (!run || run.decision !== "PENDING") {
      toast.error("Only a pending review can be rejected manually.")
      return
    }
    const timestamp = new Date().toISOString()
    setStore((current) => {
      if (!current) return current
      const latest = current.runs.find((item) => item.id === id)
      if (!latest || latest.decision !== "PENDING") return current
      return {
        ...current,
        runs: current.runs.map((item) =>
          item.id === id
            ? {
                ...withStage(item, 5, {
                  status: "fail",
                  result: "Manually rejected by a reviewer.",
                }),
                decision: "REJECTED",
                topReason: "Manually rejected by a reviewer",
                reasoning: [...item.reasoning, "A reviewer manually rejected this pending submission."],
                auditLog: [
                  ...item.auditLog,
                  {
                    timestamp,
                    action: "Manual rejection",
                    note: "Reviewer rejected this pending submission. The vendor was not added to the database.",
                  },
                ],
              }
            : item,
        ),
      }
    })
    toast.success("Rejected manually.")
  }, [])

  const clearHistory = useCallback(() => {
    if (lock.current) {
      toast.error("Wait for the current review to finish before clearing history.")
      return
    }
    setStore(defaultState())
    toast.success("History cleared. The vendor database is back to the original three vendors.")
  }, [])

  const value: ReviewContextValue = {
    hydrated: store !== null,
    runs: store?.runs ?? [],
    vendors: store?.vendors ?? [],
    isRunning,
    startRun,
    approveManually,
    rejectManually,
    clearHistory,
  }

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}

export function useReview(): ReviewContextValue {
  const value = useContext(ReviewContext)
  if (!value) {
    throw new Error("useReview must be used inside ReviewProvider")
  }
  return value
}
