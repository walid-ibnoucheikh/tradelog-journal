/** Parse a CSV string into records keyed by the (trimmed) header row. Handles quoted fields, escaped quotes, CRLF and a BOM. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ""))
  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map((h) => h.trim())
  return body.map((row) => Object.fromEntries(keys.map((key, i) => [key, (row[i] ?? "").trim()])))
}

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    endField()
    if (row.some((value) => value !== "")) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      endField()
    } else if (char === "\n") {
      endRow()
    } else if (char !== "\r") {
      field += char
    }
  }
  endRow()
  return rows
}
