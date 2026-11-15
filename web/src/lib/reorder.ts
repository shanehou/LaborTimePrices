/**
 * Returns a new array with the item at `from` moved to `to`. Out-of-range or
 * non-integer indices leave the order unchanged, but the returned array is
 * always a fresh copy so callers can use it as React state.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return items.slice()
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items.slice()
  }
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
