import { Button } from "@/components/ui/button"
import { BREAKEVEN_MAX_POINTS, BREAKEVEN_MIN_POINTS } from "@/lib/trading/trade"
import { setBreakEven } from "./actions"

const MODES = [
  { value: "auto", label: "Automatic" },
  { value: "be", label: "It's a BE" },
  { value: "not_be", label: "Not a BE" },
] as const

const points = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`

/** Shows how a trade was classified and lets Walid overrule the break-even rule. */
export function BreakEvenControl({
  tradeId,
  override,
  pointsMoved,
  detected,
}: {
  tradeId: string
  override: boolean | null
  /** Average gross points per contract, in the direction of the trade. */
  pointsMoved: number
  /** Whether the rule alone would call it a break-even. */
  detected: boolean
}) {
  const current = override === null ? "auto" : override ? "be" : "not_be"
  return (
    <form action={setBreakEven.bind(null, tradeId)} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Exit at <span className="font-medium text-foreground">{points(pointsMoved)} pt</span> per
        contract. The rule classes an exit between {points(BREAKEVEN_MIN_POINTS)} and{" "}
        {points(BREAKEVEN_MAX_POINTS)} pt as break-even: here,{" "}
        {detected ? "it's a BE" : "it's not a BE"}.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Break-even">
        {MODES.map((mode) => (
          <Button
            key={mode.value}
            type="submit"
            name="mode"
            value={mode.value}
            variant={current === mode.value ? "default" : "outline"}
            aria-pressed={current === mode.value}
          >
            {mode.label}
          </Button>
        ))}
      </div>
    </form>
  )
}
