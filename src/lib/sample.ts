/**
 * At most `max` items, evenly spread over the list and always keeping the first and the last. A chart
 * of tens of thousands of points looks the same as one of 1,500 and weighs a hundred times more.
 */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max || max < 2) return items.length <= max ? items : items.slice(0, max)
  const step = (items.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, index) => items[Math.round(index * step)])
}
