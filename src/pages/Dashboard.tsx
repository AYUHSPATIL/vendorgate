import { CircleCheck, CircleX, ClipboardList, Clock, Search, ShieldExclamationPoint } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { ErrorBoundary } from "../components/ErrorBoundary.tsx"
import { StatusBadge } from "../components/StatusBadge.tsx"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.tsx"
import { Input } from "../components/ui/input.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx"
import { PRESETS } from "../data/presets.ts"
import { useReview } from "../context/ReviewContext.tsx"
import { exportRunsCsv } from "../lib/storage.ts"
import type { Decision, Run } from "../lib/types.ts"
import { formatTimestamp } from "../lib/utils.ts"

const FILTERS = ["ALL", "APPROVED", "PENDING", "REJECTED", "FAILED"] as const
type Filter = (typeof FILTERS)[number]

export function Dashboard() {
  const navigate = useNavigate()
  const { hydrated, runs, isRunning, startRun, approveManually, rejectManually, clearHistory } = useReview()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("ALL")
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    document.title = "Dashboard · VendorGate"
  }, [])

  const counts = useMemo(() => {
    return {
      total: runs.length,
      approved: runs.filter((run) => run.decision === "APPROVED").length,
      pending: runs.filter((run) => run.decision === "PENDING").length,
      rejected: runs.filter((run) => run.decision === "REJECTED").length,
      failed: runs.filter((run) => run.decision === "FAILED").length,
      running: runs.filter((run) => run.decision === "RUNNING").length,
      escalated: runs.filter((run) => run.escalate && run.decision === "PENDING").length,
    }
  }, [runs])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...runs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((run) => (filter === "ALL" ? true : run.decision === filter))
      .filter((run) => {
        if (!needle) return true
        const haystack = [run.id, run.submission.companyName, run.submission.country, run.topReason, run.decision]
          .join(" ")
          .toLowerCase()
        return haystack.includes(needle)
      })
  }, [runs, query, filter])

  const chartData = [
    { name: "Approved", value: counts.approved, color: "#16a34a" },
    { name: "Pending", value: counts.pending, color: "#d97706" },
    { name: "Rejected", value: counts.rejected, color: "#dc2626" },
    { name: "Failed", value: counts.failed, color: "#64748b" },
    { name: "Running", value: counts.running, color: "#4f46e5" },
  ].filter((item) => item.value > 0)

  function runSample() {
    const preset = PRESETS.find((item) => item.id === "happy")
    if (!preset) return
    const id = startRun(preset.submission)
    if (!id) {
      toast.error("A review is already running. Open Live Run to watch it.")
      return
    }
    navigate(`/run/${id}`)
  }

  function onExport() {
    try {
      exportRunsCsv(runs)
      toast.success(`Exported ${runs.length} run${runs.length === 1 ? "" : "s"}`)
    } catch (error) {
      console.error(error)
      toast.error("Could not export the CSV.")
    }
  }

  function onConfirmClear() {
    clearHistory()
    setConfirmClear(false)
    setQuery("")
    setFilter("ALL")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Every review is stored here with its reasoning and audit trail.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onExport} disabled={!hydrated}>
            Export CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirmClear(true)} disabled={!hydrated || isRunning}>
            Clear all history
          </Button>
        </div>
      </div>

      {!hydrated ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">Loading saved reviews…</p>
          </CardContent>
        </Card>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ClipboardList className="h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No reviews yet</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Run a vendor submission to see the decision, the reasoning, and the audit trail in this list.
            </p>
            <Button type="button" className="mt-4" onClick={runSample} disabled={isRunning}>
              Run a sample scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Total runs" value={counts.total} icon={<ClipboardList className="h-4 w-4 text-slate-500" />} />
            <Stat label="Approved" value={counts.approved} icon={<CircleCheck className="h-4 w-4 text-green-600" />} />
            <Stat label="Pending" value={counts.pending} icon={<Clock className="h-4 w-4 text-amber-500" />} />
            <Stat label="Rejected" value={counts.rejected} icon={<CircleX className="h-4 w-4 text-red-600" />} />
            <Stat
              label="Escalated for human review"
              value={counts.escalated}
              icon={<ShieldExclamationPoint className="h-4 w-4 text-amber-600" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status distribution</CardTitle>
              <CardDescription>Approved, pending, rejected, and failed runs in this browser.</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-slate-600">Status counts appear when a review finishes.</p>
              ) : (
                <ErrorBoundary fallback={<StatusBars data={chartData} />} title="Chart unavailable">
                  <div
                    className="h-72 w-full"
                    role="img"
                    aria-label={`Approved ${counts.approved}, pending ${counts.pending}, rejected ${counts.rejected}, failed ${counts.failed}, running ${counts.running}`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="#fff">
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ErrorBoundary>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runs</CardTitle>
              <CardDescription>
                {filtered.length} of {runs.length} shown. Export downloads every saved run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search vendor, run ID, country, or reason"
                    className="pl-9"
                    aria-label="Search runs"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                    <SelectTrigger aria-label="Filter by status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTERS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item === "ALL" ? "All statuses" : titleCase(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
                  <p className="text-sm text-slate-600">No runs match this search.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setQuery("")
                      setFilter("ALL")
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">Run ID</th>
                        <th className="px-2 py-2 font-medium">Timestamp</th>
                        <th className="px-2 py-2 font-medium">Vendor</th>
                        <th className="px-2 py-2 font-medium">Country</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Escalated</th>
                        <th className="px-2 py-2 font-medium">Top reason</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((run) => (
                        <RunRow
                          key={run.id}
                          run={run}
                          onView={() => navigate(`/run/${run.id}`)}
                          onApprove={() => approveManually(run.id)}
                          onReject={() => rejectManually(run.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all history?</DialogTitle>
            <DialogDescription>
              This deletes every stored run, resets run IDs to RUN-0001, and restores the vendor database to the
              original three seed vendors. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmClear}>
              Clear all history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function StatusBars({ data }: { data: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RunRow({
  run,
  onView,
  onApprove,
  onReject,
}: {
  run: Run
  onView: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="px-2 py-3 font-medium text-slate-900">{run.id}</td>
      <td className="px-2 py-3 whitespace-nowrap text-slate-600">{formatTimestamp(run.createdAt)}</td>
      <td className="px-2 py-3 text-slate-800">{run.submission.companyName || "—"}</td>
      <td className="px-2 py-3 text-slate-600">{run.submission.country || "—"}</td>
      <td className="px-2 py-3">
        <StatusBadge decision={run.decision} />
      </td>
      <td className="px-2 py-3">
        {run.escalate ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset">
            Yes
          </span>
        ) : (
          <span className="text-slate-400">No</span>
        )}
      </td>
      <td className="max-w-xs px-2 py-3 text-slate-600">{run.topReason}</td>
      <td className="px-2 py-3">
        <div className="flex min-w-36 flex-col gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onView}>
            View
          </Button>
          {run.decision === "PENDING" ? (
            <>
              <Button type="button" size="sm" onClick={onApprove}>
                Approve manually
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={onReject}>
                Reject manually
              </Button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function titleCase(value: Decision | Filter): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}
