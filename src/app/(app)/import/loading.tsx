import { PageHeader } from "@/components/page-header"
import { ContentSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <>
      <PageHeader title="Import" />
      <ContentSkeleton />
    </>
  )
}
