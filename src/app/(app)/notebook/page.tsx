import { Suspense } from "react"
import { NotebookWorkspace } from "@/components/notebook/notebook-workspace"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getNotebook } from "@/db/notebook"

async function Notebook() {
  const { folders, items } = await getNotebook()
  return <NotebookWorkspace folders={folders} items={items} />
}

export default function NotebookPage() {
  return (
    <>
      <PageHeader title="Notebook" />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
        <Notebook />
      </Suspense>
    </>
  )
}
