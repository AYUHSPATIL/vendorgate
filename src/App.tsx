import { BrowserRouter, Link, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ErrorBoundary } from "./components/ErrorBoundary.tsx"
import { Layout } from "./components/Layout.tsx"
import { Button } from "./components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card.tsx"
import { ReviewProvider } from "./context/ReviewContext.tsx"
import { Assumptions } from "./pages/Assumptions.tsx"
import { Dashboard } from "./pages/Dashboard.tsx"
import { LiveRun } from "./pages/LiveRun.tsx"
import { NewSubmission } from "./pages/NewSubmission.tsx"

export default function App() {
  return (
    <ErrorBoundary>
      <ReviewProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<NewSubmission />} />
              <Route path="run" element={<LiveRun />} />
              <Route path="run/:id" element={<LiveRun />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="rules" element={<Assumptions />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </BrowserRouter>
      </ReviewProvider>
    </ErrorBoundary>
  )
}

function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Page not found</CardTitle>
        <CardDescription>That address is not part of VendorGate.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/">Back to new submission</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
