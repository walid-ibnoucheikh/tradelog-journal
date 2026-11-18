import { PageHeader } from "@/components/page-header"
import { TradesSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <>
      <PageHeader title="Trades" />
      <TradesSkeleton />
    </>
  )
}
