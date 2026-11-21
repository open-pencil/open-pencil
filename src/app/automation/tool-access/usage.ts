import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

const usageSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    startedAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
    counts: v.record(v.string(), v.pipe(v.number(), v.safeInteger(), v.minValue(0)))
  })
)

/** Local to this app profile; counts calls across chat, MCP and WebMCP, including failures. */
export const toolUsage = useLocalStorage<v.InferOutput<typeof usageSchema>>(
  'open-pencil:tools:usage',
  { startedAt: null, counts: {} },
  {
    flush: 'sync',
    serializer: {
      read: (raw) => {
        const result = v.safeParse(usageSchema, raw)
        return result.success ? result.output : { startedAt: null, counts: {} }
      },
      write: JSON.stringify
    }
  }
)

export function toolUseCount(name: string): number {
  return Object.hasOwn(toolUsage.value.counts, name) ? (toolUsage.value.counts[name] ?? 0) : 0
}

/** A call admitted to the app runner, not an advertised tool or a nested script operation. */
export function recordToolUse(name: string): void {
  toolUsage.value = {
    startedAt: toolUsage.value.startedAt ?? new Date().toISOString(),
    counts: {
      ...toolUsage.value.counts,
      [name]: Math.min(Number.MAX_SAFE_INTEGER, toolUseCount(name) + 1)
    }
  }
}
