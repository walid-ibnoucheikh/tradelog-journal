import { Field, selectClass } from "@/components/form-field"
import { Input } from "@/components/ui/input"

/** Name, firm, Tradovate name, type and starting balance: shared by the create and edit forms. */
export function AccountFields({ values }: { values: Record<string, string | undefined> }) {
  return (
    <>
      <Field label="Account name">
        <Input name="name" defaultValue={values.name} placeholder="Apex 50K #1" required />
      </Field>
      <Field label="Prop firm">
        <Input name="firm" list="firms" defaultValue={values.firm} placeholder="Apex" required />
        <datalist id="firms">
          <option value="Apex" />
          <option value="Tradeify" />
          <option value="Lucid" />
        </datalist>
      </Field>
      <Field
        label="Tradovate account name"
        hint="As it appears in the Account column of the Fills file."
      >
        <Input
          name="tradovateName"
          defaultValue={values.tradovateName}
          className="font-mono"
          required
        />
      </Field>
      <Field
        label="Tradovate username (optional)"
        hint="The login of this account, to sync it. Same username as another account of this prop firm = same login."
      >
        <Input
          name="tradovateUsername"
          defaultValue={values.tradovateUsername}
          autoComplete="off"
        />
      </Field>
      <Field label="Tradovate password (optional)" hint="Stored encrypted, never shown again.">
        <Input name="tradovatePassword" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Type">
        <select
          key={values.type}
          name="type"
          defaultValue={values.type ?? "eval"}
          className={selectClass}
        >
          <option value="eval">Evaluation</option>
          <option value="funded">Funded</option>
        </select>
      </Field>
      <Field label="Initial balance ($)">
        <Input
          name="initialBalance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.initialBalance}
          required
        />
      </Field>
    </>
  )
}
