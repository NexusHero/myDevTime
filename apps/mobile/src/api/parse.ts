/**
 * Tiny defensive JSON-shape readers shared by the client API parsers (issue #11).
 * They turn `unknown` fetch bodies into typed fields, throwing on the wrong shape
 * so a malformed payload fails loudly at the seam rather than corrupting a screen.
 */

export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw new Error('expected an object')
  return value as Record<string, unknown>
}

export function str(o: Record<string, unknown>, key: string): string {
  const v = o[key]
  if (typeof v !== 'string') throw new Error(`expected string field "${key}"`)
  return v
}

export function nullableStr(o: Record<string, unknown>, key: string): string | null {
  const v = o[key]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new Error(`expected string|null field "${key}"`)
  return v
}

export function parseArray<T>(value: unknown, one: (o: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) throw new Error('expected an array')
  return value.map(item => one(record(item)))
}
