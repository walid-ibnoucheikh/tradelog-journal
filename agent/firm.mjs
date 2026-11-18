/** The same firm written "Lucid", "lucid " or "LUCID" is one login and one browser profile. */
export function firmKey(firm) {
  const key = firm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  if (!key) throw new Error("A prop firm name is needed, e.g. Lucid")
  return key
}
