import { importTradovateFiles } from "@/db/import-fills"
import { invalidateData } from "@/db/cache"
import { getRunningRequest } from "@/db/sync"
import { CashCsvError } from "@/lib/trading/tradovate/cash"
import { detectTradovateFile } from "@/lib/trading/tradovate/detect"
import { FillsCsvError } from "@/lib/trading/tradovate/fills"
import { syncGuard } from "@/lib/sync/sync-guard"
import { isUuid } from "@/lib/sync/sync-input"

/** Both files together, like the import form: a request body is capped at 4.5 MB on Vercel. */
const MAX_BODY_BYTES = 4 * 1024 * 1024

/** The cloud run hands over the exported files of an account: `{ fills?: string, cash?: string }`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await syncGuard(request)
  if (denied) return denied

  const { id } = await params
  if (!isUuid(id)) return Response.json({ error: "Bad request id." }, { status: 400 })
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "The files exceed 4 MB." }, { status: 413 })
  }
  if (!(await getRunningRequest(id))) {
    return Response.json({ error: "This request is not running." }, { status: 409 })
  }

  const body: unknown = await request.json().catch(() => null)
  const fills = (body as { fills?: unknown } | null)?.fills
  const cash = (body as { cash?: unknown } | null)?.cash
  if (
    (fills !== undefined && typeof fills !== "string") ||
    (cash !== undefined && typeof cash !== "string") ||
    (!fills && !cash)
  ) {
    return Response.json({ error: "Send `fills` and/or `cash` as CSV text." }, { status: 400 })
  }

  // A wrong file must fail loudly: the parsers alone read an unrelated CSV as "no rows".
  if (
    (typeof fills === "string" && detectTradovateFile(fills) !== "fills") ||
    (typeof cash === "string" && detectTradovateFile(cash) !== "cash")
  ) {
    return Response.json(
      { error: "Invalid file: not a Tradovate Fills or Cash History export." },
      { status: 422 }
    )
  }

  try {
    const summary = await importTradovateFiles({
      fills: fills as string | undefined,
      cash: cash as string | undefined,
    })
    invalidateData() // the pages are cached: the new trades must show
    return Response.json(summary)
  } catch (error) {
    if (error instanceof FillsCsvError || error instanceof CashCsvError) {
      return Response.json({ error: `Invalid file: ${error.message}` }, { status: 422 })
    }
    console.error("Sync import failed", error)
    return Response.json({ error: "The import failed." }, { status: 500 })
  }
}
