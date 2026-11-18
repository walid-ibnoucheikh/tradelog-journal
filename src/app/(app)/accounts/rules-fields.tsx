import { Field, selectClass } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import { DRAWDOWN_TYPES } from "@/lib/accounts/account-rules"

/** The rules a prop firm sets on an account. Every field is optional: empty means no such rule. */
export function RulesFields({ values }: { values: Record<string, string | undefined> }) {
  return (
    <>
      <Field label="Profit target ($)" hint="Optional.">
        <Input
          name="profitTarget"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.profitTarget}
        />
      </Field>
      <Field
        label="Max drawdown ($)"
        hint="Optional. The distance between the balance peak and the liquidation threshold."
      >
        <Input
          name="maxDrawdown"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.maxDrawdown}
        />
      </Field>
      <Field
        label="Drawdown type"
        hint="EOD: the liquidation threshold rises when a session ends. Intraday: it rises with every new balance high."
      >
        <select
          key={values.drawdownType}
          name="drawdownType"
          defaultValue={values.drawdownType ?? "eod_trailing"}
          className={selectClass}
        >
          {DRAWDOWN_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Lock threshold at ($, balance)"
        hint="Optional. The liquidation threshold never rises above this balance (for example 50,100 on a 50K account)."
      >
        <Input
          name="drawdownLockLevel"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.drawdownLockLevel}
        />
      </Field>
      <Field label="Max daily loss ($)" hint="Optional.">
        <Input
          name="dailyLossLimit"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.dailyLossLimit}
        />
      </Field>
      <Field
        label="Consistency rule (%)"
        hint="Optional. The best day may not exceed this share of the total profit (for example 40)."
      >
        <Input
          name="consistencyPercent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={values.consistencyPercent}
        />
      </Field>
    </>
  )
}
