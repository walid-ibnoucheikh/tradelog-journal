"use client"

import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useState } from "react"
import { EditAccountForm } from "@/app/(app)/accounts/edit-account-form"
import { LifecycleForm } from "@/app/(app)/accounts/lifecycle-form"
import { PaymentForm } from "@/app/(app)/accounts/payment-form"
import { RulesForm } from "@/app/(app)/accounts/rules-form"
import { AccountStatusBadge } from "@/components/account-status-badge"
import { CloseContext } from "@/components/modal"
import { FinalSyncButton } from "./final-sync-button"
import type { AccountView } from "@/lib/accounts/account-views"
import { cn } from "@/lib/utils"
import { AccountDetails } from "./account-details"

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "rules", label: "Rules" },
  { value: "status", label: "Status" },
  { value: "payment", label: "Payment" },
  { value: "edit", label: "Edit" },
] as const

type Tab = (typeof TABS)[number]["value"]

function PanelContent({ view, now }: { view: AccountView; now: Date }) {
  const [tab, setTab] = useState<Tab>("overview")

  return (
    // A form that saves successfully goes back to the overview, which shows the new figures.
    <CloseContext.Provider value={() => setTab("overview")}>
      <div
        role="tablist"
        aria-label="Account"
        className="flex gap-0.5 overflow-x-auto border-b px-2 sm:gap-1 sm:px-3"
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              "-mb-px min-h-10 shrink-0 border-b-2 border-transparent px-2.5 text-sm sm:px-3 text-muted-foreground hover:text-foreground",
              tab === item.value && "border-primary font-medium text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "overview" && (
          <AccountDetails view={view} now={now} onAddPayment={() => setTab("payment")} />
        )}
        {tab === "rules" && <RulesForm accountId={view.id} rules={view.rules} />}
        {tab === "status" && (
          <div className="space-y-5">
            {view.status === "active" && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="text-muted-foreground">
                  Before marking this account blown or closed, sync it one last time: Tradovate may
                  remove it soon, and its last trades could not be recovered afterwards.
                </p>
                <div className="mt-2">
                  <FinalSyncButton accountId={view.id} />
                </div>
              </div>
            )}
            <LifecycleForm
              accountId={view.id}
              status={view.status}
              fundedAt={view.fundedAt}
              endedAt={view.endedAt}
            />
          </div>
        )}
        {tab === "payment" && (
          <PaymentForm
            accountId={view.id}
            // The first thing to record is what the account cost; later ones are usually resets.
            defaultType={
              view.contents.transactions === 0
                ? view.type === "funded"
                  ? "activation"
                  : "evaluation"
                : "reset"
            }
          />
        )}
        {tab === "edit" && (
          <EditAccountForm
            account={{
              id: view.id,
              name: view.name,
              firm: view.firm,
              tradovateName: view.tradovateName,
              type: view.type,
              initialBalance: view.initialBalance,
            }}
            contents={view.contents}
          />
        )}
      </div>
    </CloseContext.Provider>
  )
}

/** Side panel with everything about one account and the forms to change it. Closed when `view` is null. */
export function AccountPanel({
  view,
  now,
  onClose,
}: {
  view: AccountView | null
  now: Date
  onClose: () => void
}) {
  return (
    <Dialog.Root open={view !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          // A tap must not put the cursor in the first field: the iPhone keyboard would open at once and
          // push the window out of the screen. With a mouse or the keyboard the first field keeps the focus.
          initialFocus={(type) => type !== "touch"}
          className="fixed inset-y-0 right-0 z-50 flex w-[min(32rem,100vw)] flex-col border-l bg-card text-card-foreground shadow-xl outline-none"
        >
          {view && (
            <>
              <div className="flex items-start gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                  <Dialog.Title className="truncate text-base font-semibold">
                    {view.name}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {view.firm} · {view.type === "funded" ? "Funded" : "Evaluation"}
                  </Dialog.Description>
                </div>
                <AccountStatusBadge status={view.status} />
                <Dialog.Close
                  aria-label="Close"
                  className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <PanelContent key={view.id} view={view} now={now} />
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
