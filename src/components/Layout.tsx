import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useReview } from "../context/ReviewContext.tsx"
import { cn } from "../lib/utils.ts"
import { ErrorBoundary } from "./ErrorBoundary.tsx"

function navClass(active: boolean) {
  return cn(
    "rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors sm:text-left",
    active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  )
}

export function Layout() {
  const location = useLocation()
  const { runs } = useReview()
  const running = runs.find((run) => run.decision === "RUNNING")
  const liveTo = running ? `/run/${running.id}` : runs[0] ? `/run/${runs[0].id}` : "/run"
  const onLive = location.pathname === "/run" || location.pathname.startsWith("/run/")

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <NavLink to="/" className="flex w-fit items-center gap-2 self-start">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              VG
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight text-slate-900">VendorGate</span>
              <span className="block text-xs text-slate-500">Vendor onboarding review</span>
            </span>
          </NavLink>
          <nav className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
              New Submission
            </NavLink>
            <NavLink to={liveTo} className={() => navClass(onLive)}>
              Live Run
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => navClass(isActive)}>
              Dashboard
            </NavLink>
            <NavLink to="/rules" className={({ isActive }) => navClass(isActive)}>
              Assumptions & Rules
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Decisions are rule-based and stored in this browser.</p>
          <p>AI is used only to draft vendor emails, with a template fallback.</p>
        </div>
      </footer>
    </div>
  )
}
