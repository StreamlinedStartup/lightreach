/** Serialize any value to a JSON string, converting Dates to ISO strings. */
export function toText(data: unknown): string {
  return JSON.stringify(
    data,
    (_key, value) => (value instanceof Date ? value.toISOString() : value),
    2,
  )
}

/** Wrap data in an MCP text-content response. */
export function ok(data: unknown = null) {
  return { content: [{ type: 'text' as const, text: toText(data) }] }
}

/** Wrap an error message in an MCP error response. */
export function err(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  }
}
