import { describe, expect, it } from "vitest"
import {
  FOLDER_ALL,
  FOLDER_JOURNAL,
  FOLDER_MINE,
  FOLDER_TRADES,
  groupByRecency,
  itemsOfFolder,
  newestFirst,
  searchItems,
  type NotebookItem,
} from "./notebook"

const item = (overrides: Partial<NotebookItem>): NotebookItem => ({
  key: "free:1",
  kind: "free",
  id: "1",
  title: "Idea",
  subtitle: "",
  href: null,
  updatedAt: "2026-10-01T10:00:00.000Z",
  content: "",
  text: "",
  folderId: null,
  ...overrides,
})

const items = [
  item({ key: "free:1", id: "1", title: "Rules", folderId: null }),
  item({ key: "free:2", id: "2", title: "Setups", folderId: "f1" }),
  item({ key: "day:2026-10-02", kind: "day", id: "2026-10-02", title: "Fri, Oct 2" }),
  item({ key: "trade:9", kind: "trade", id: "9", title: "MNQ trade" }),
]

describe("itemsOfFolder", () => {
  it("lists every note, the journal, the trade notes and the notes outside any folder", () => {
    expect(itemsOfFolder(items, FOLDER_ALL)).toHaveLength(4)
    expect(itemsOfFolder(items, FOLDER_JOURNAL).map((i) => i.kind)).toEqual(["day"])
    expect(itemsOfFolder(items, FOLDER_TRADES).map((i) => i.kind)).toEqual(["trade"])
    expect(itemsOfFolder(items, FOLDER_MINE).map((i) => i.id)).toEqual(["1"])
  })

  it("lists the free notes of a folder created by the user", () => {
    expect(itemsOfFolder(items, "f1").map((i) => i.id)).toEqual(["2"])
  })
})

describe("searchItems", () => {
  const found = [
    item({ id: "a", title: "Breakout", text: "Entered late after the retest" }),
    item({ id: "b", title: "Écoute", text: "Overtraded in the afternoon" }),
  ]

  it("matches every word in the title or the text", () => {
    expect(searchItems(found, "retest late").map((i) => i.id)).toEqual(["a"])
    expect(searchItems(found, "retest afternoon")).toEqual([])
  })

  it("ignores case and accents, and returns everything for an empty query", () => {
    expect(searchItems(found, "ECOUTE").map((i) => i.id)).toEqual(["b"])
    expect(searchItems(found, "  ")).toHaveLength(2)
  })
})

describe("newestFirst", () => {
  it("sorts by last edit, newest first, without changing the input", () => {
    const list = [
      item({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      item({ id: "new", updatedAt: "2026-06-01T00:00:00.000Z" }),
    ]
    expect(newestFirst(list).map((i) => i.id)).toEqual(["new", "old"])
    expect(list[0].id).toBe("old")
  })
})

describe("groupByRecency", () => {
  const now = new Date(2026, 10, 15, 12, 0, 0) // 15 November 2026, noon
  const at = (daysAgo: number) => new Date(2026, 10, 15 - daysAgo, 9, 0, 0).toISOString()

  it("groups by how long ago a note was edited, newest group first", () => {
    const groups = groupByRecency(
      [
        item({ id: "old", updatedAt: at(90) }),
        item({ id: "today", updatedAt: at(0) }),
        item({ id: "week", updatedAt: at(4) }),
        item({ id: "yesterday", updatedAt: at(1) }),
        item({ id: "month", updatedAt: at(20) }),
      ],
      now
    )
    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Previous 30 days",
      "Older",
    ])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ["today"],
      ["yesterday"],
      ["week"],
      ["month"],
      ["old"],
    ])
  })

  it("keeps notes of the same group together and skips empty groups", () => {
    const groups = groupByRecency(
      [item({ id: "a", updatedAt: at(0) }), item({ id: "b", updatedAt: at(0) })],
      now
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
  })
})
