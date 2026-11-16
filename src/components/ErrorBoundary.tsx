import { Component, type ErrorInfo, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "./ui/button.tsx"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  resetKey?: string
  title?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VendorGate render error", error, info)
    if (!this.props.fallback) {
      toast.error("This screen hit an unexpected error. You can reload or start another submission.")
    }
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{this.props.title ?? "Something went wrong"}</h1>
        <p className="mt-2 text-sm text-slate-600">
          VendorGate caught an unexpected error and stopped this screen from going blank. The details are in the
          browser console.
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{this.state.error.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign("/")}>
            New submission
          </Button>
        </div>
      </div>
    )
  }
}
