import { Plus } from "lucide-react"
import { Suspense } from "react"
import { ContentSkeleton } from "@/components/skeletons"
import { AccountSuggestions } from "@/components/accounts/account-suggestions"
import { AccountsSummaryStrip } from "@/components/accounts/accounts-summary"
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace"
import { ModalButton } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { getAccountsModel } from "@/db/accounts-model"
import { AccountForm } from "./account-form"

function NewAccountButton({ label = "Add account" }: { label?: string }) {
  return (
    <ModalButton
      label={label}
      icon={<Plus />}
      title="Add account"
      description="A prop firm account tracked in Tradelog."
      wide
    >
      <AccountForm />
    </ModalButton>
  )
}

async function Accounts() {
  const model = await getAccountsModel()

  if (model.empty) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="font-medium">No accounts yet.</p>
        <p className="mb-4 text-sm text-muted-foreground">
          Add your first account, then import your Fills file from Tradovate.
        </p>
        <NewAccountButton label="Create an account" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AccountSuggestions suggestions={model.suggestions} />
      <AccountsSummaryStrip summary={model.summary} />
      <AccountsWorkspace active={model.active} ended={model.ended} now={model.now} />
    </div>
  )
}

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" action={<NewAccountButton />} />
      <Suspense fallback={<ContentSkeleton />}>
        <Accounts />
      </Suspense>
    </>
  )
}
