import { PageHeader } from "@/components/page-header"
import { JournalSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <>
      <PageHeader title="Daily Journal" />
      <JournalSkeleton />
    </>
  )
}
