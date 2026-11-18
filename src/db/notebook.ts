import { asc, isNotNull, ne, and } from "drizzle-orm"
import { db } from "@/db"
import { dayNotes, noteFolders, notes, trades } from "@/db/schema"
import { formatDayYear, formatLongDay, formatUsd } from "@/lib/format"
import { noteText, parseNote } from "@/lib/note"
import type { NotebookFolder, NotebookItem } from "@/lib/notebook"
import { dayKey } from "@/lib/trading/stats"

const plain = (content: string) => noteText(parseNote(content)).replace(/\s+/g, " ").trim()

/** Every note of the Notebook: free notes, the notes of the journal days and the notes of the trades. */
export async function getNotebook(): Promise<{ folders: NotebookFolder[]; items: NotebookItem[] }> {
  const [folderRows, freeRows, dayRows, tradeRows] = await Promise.all([
    db.select().from(noteFolders).orderBy(asc(noteFolders.name)),
    db.select().from(notes),
    db.select().from(dayNotes),
    db
      .select({
        id: trades.id,
        contract: trades.contract,
        closedAt: trades.closedAt,
        netPnl: trades.netPnl,
        note: trades.note,
      })
      .from(trades)
      .where(and(isNotNull(trades.note), ne(trades.note, ""))),
  ])

  const items: NotebookItem[] = [
    ...freeRows.map((row) => ({
      key: `free:${row.id}`,
      kind: "free" as const,
      id: row.id,
      title: row.title,
      subtitle: "",
      href: null,
      updatedAt: row.updatedAt.toISOString(),
      content: row.content,
      text: plain(row.content),
      folderId: row.folderId,
    })),
    ...dayRows.map((row) => ({
      key: `day:${row.day}`,
      kind: "day" as const,
      id: row.day,
      title: formatLongDay(row.day),
      subtitle: "Daily Journal",
      href: `/journal?month=${row.day.slice(0, 7)}#day-${row.day}`,
      updatedAt: row.updatedAt.toISOString(),
      content: row.note,
      text: plain(row.note),
      folderId: null,
    })),
    ...tradeRows.map((row) => ({
      key: `trade:${row.id}`,
      kind: "trade" as const,
      id: row.id,
      title: `${row.contract} trade · ${formatDayYear(dayKey(row.closedAt))}`,
      subtitle: `Net P&L ${formatUsd(row.netPnl)}`,
      href: `/trades/${row.id}`,
      // A trade has no edit date of its own: its close date orders its note.
      updatedAt: row.closedAt.toISOString(),
      content: row.note ?? "",
      text: plain(row.note ?? ""),
      folderId: null,
    })),
  ]
  return { folders: folderRows.map(({ id, name }) => ({ id, name })), items }
}
