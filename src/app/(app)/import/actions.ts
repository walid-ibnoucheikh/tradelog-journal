"use server"

import { updateTag } from "next/cache"
import { requireAuth } from "@/lib/auth/auth"
import { DATA_TAG } from "@/db/cache"
import { importTradovateFiles, type ImportSummary } from "@/db/import-fills"
import { CashCsvError } from "@/lib/trading/tradovate/cash"
import { FillsCsvError } from "@/lib/trading/tradovate/fills"

export interface ImportState {
  error?: string
  summary?: ImportSummary
}

/** Both files together: a Server Action body is capped at 5 MB. */
const MAX_TOTAL_SIZE = 4 * 1024 * 1024

/** The file of a form field, or null when none was chosen. */
function chosenFile(formData: FormData, name: string) {
  const file = formData.get(name)
  return file instanceof File && file.size > 0 ? file : null
}

export async function importFillsAction(
  _previous: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireAuth()
  const fills = chosenFile(formData, "fills")
  const cash = chosenFile(formData, "cash")
  if (!fills && !cash) {
    return { error: "Choose at least one file: Fills.csv or Cash History.csv." }
  }
  if ((fills?.size ?? 0) + (cash?.size ?? 0) > MAX_TOTAL_SIZE) {
    return { error: "The files exceed 4 MB in total." }
  }

  try {
    const summary = await importTradovateFiles({
      fills: fills ? await fills.text() : undefined,
      cash: cash ? await cash.text() : undefined,
    })
    updateTag(DATA_TAG) // the pages are cached: the new trades must show
    return { summary }
  } catch (error) {
    if (error instanceof FillsCsvError || error instanceof CashCsvError) {
      return { error: `Invalid file: ${error.message}` }
    }
    if (error instanceof Error && error.message.startsWith("Unsupported product")) {
      return { error: `${error.message}. Only NQ and MNQ are supported for now.` }
    }
    console.error("Tradovate import failed", error)
    return { error: "The import failed. Check the server logs." }
  }
}
