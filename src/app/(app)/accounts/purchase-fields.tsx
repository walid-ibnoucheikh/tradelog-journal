import { Field, selectClass } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import { TRANSACTION_TYPES } from "@/lib/investments/investments"
import { PURCHASE_TYPES } from "@/lib/investments/purchase"

/** What the account cost: recorded as a transaction linked to it, so spending and ROI are right from day one. */
export function PurchaseFields({
  values,
  today,
}: {
  values: Record<string, string | undefined>
  today: string
}) {
  return (
    <>
      <div className="sm:col-span-2">
        <p className="text-sm font-medium">Purchase (optional)</p>
        <p className="text-sm text-muted-foreground">
          What you paid for this account. Leave the cost empty to add it later, from the account or
          from Investments.
        </p>
      </div>
      <Field label="Cost (USD)">
        <Input
          name="purchaseAmount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={values.purchaseAmount}
          placeholder="e.g. 149"
        />
      </Field>
      <Field label="Date">
        <Input name="purchaseDay" type="date" defaultValue={values.purchaseDay ?? today} />
      </Field>
      <Field label="Bought as">
        <select
          key={values.purchaseType}
          name="purchaseType"
          defaultValue={values.purchaseType ?? "evaluation"}
          className={selectClass}
        >
          {PURCHASE_TYPES.map((value) => (
            <option key={value} value={value}>
              {TRANSACTION_TYPES.find((type) => type.value === value)?.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}
