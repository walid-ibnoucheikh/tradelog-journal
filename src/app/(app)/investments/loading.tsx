import { PageHeader } from "@/components/page-header"
import { InvestmentsSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <>
      <PageHeader title="Investments" />
      <InvestmentsSkeleton />
    </>
  )
}
