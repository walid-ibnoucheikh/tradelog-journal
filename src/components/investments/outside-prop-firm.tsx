import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatUsd } from "@/lib/format"
import type { OutsidePropFirm } from "@/lib/investments/investment-report"
import { TRANSACTION_TYPES } from "@/lib/investments/investments"

const typeLabel = new Map<string, string>(TRANSACTION_TYPES.map((t) => [t.value, t.label]))

/** Courses, mentoring and tools: what they cost in total and by provider. */
export function OutsidePropFirmSection({ data }: { data: OutsidePropFirm }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-medium">Outside prop firms</h2>
        <p className="text-sm text-muted-foreground">
          Courses, mentors, tools and subscriptions: {formatUsd(data.cost)} in total, or{" "}
          {Math.round(data.share)}% of your spending. They count in the net and the ROI, but not in
          the prop firms or in the cost per funded account.
        </p>
      </div>
      <Card className="p-0 ring-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={`${row.type}:${row.provider.toLowerCase()}`}>
                <TableCell className="font-medium">{row.provider}</TableCell>
                <TableCell>{typeLabel.get(row.type)}</TableCell>
                <TableCell className="text-right">{row.payments}</TableCell>
                <TableCell className="text-right">{formatUsd(row.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  )
}
