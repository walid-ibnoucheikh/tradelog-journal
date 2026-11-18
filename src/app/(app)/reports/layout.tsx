import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ReportNav } from "@/components/reports/report-nav"

export default function ReportsLayout({ children }: LayoutProps<"/reports">) {
  return (
    <>
      <PageHeader title="Reports" filters />
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* useSearchParams in the menu needs a Suspense boundary. */}
        <Suspense fallback={<div className="h-10" />}>
          <ReportNav />
        </Suspense>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </>
  )
}
