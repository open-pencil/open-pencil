import type { FeedbackServices } from '#feedback/env'
import type { CalendarDate } from '@internationalized/date'
import * as v from 'valibot'

import { DEADLINE_MS } from '@open-pencil/std/timing'

/**
 * The longest range npm's download counts answer for, about 18 months; older days are not kept.
 * https://github.com/npm/registry/blob/master/docs/download-counts.md
 */
export const NPM_MAX_DAYS = 540

const countSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const packagesSchema = v.record(v.string(), v.string())
const downloadsSchema = v.object({
  downloads: v.array(v.object({ day: v.pipe(v.string(), v.isoDate()), downloads: countSchema }))
})

async function read<T extends v.GenericSchema>(
  fetch: FeedbackServices['fetch'],
  url: string,
  schema: T
): Promise<v.InferOutput<T>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DEADLINE_MS.slowRequest) })
  if (!response.ok) throw new Error(`npm answered ${response.status} for ${url}`)
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
  if (!parsed.success) throw new Error(`npm sent an unexpected answer for ${url}`)
  return parsed.output
}

/** npm's public registry and download counts, which need no token. */
export function npmClient(fetch: FeedbackServices['fetch']) {
  return {
    /** Every package the organization publishes, by name. */
    async packages(org: string): Promise<string[]> {
      const packages = await read(
        fetch,
        `https://registry.npmjs.org/-/org/${encodeURIComponent(org)}/package`,
        packagesSchema
      )
      return Object.keys(packages).toSorted()
    },
    /**
     * Downloads per day from `start` to `end`, a day each, zeros included. Scoped packages have
     * no bulk query, so each is asked for on its own.
     */
    async downloads(name: string, start: CalendarDate, end: CalendarDate) {
      const answer = await read(
        fetch,
        `https://api.npmjs.org/downloads/range/${start.toString()}:${end.toString()}/${name}`,
        downloadsSchema
      )
      return answer.downloads
    }
  }
}
