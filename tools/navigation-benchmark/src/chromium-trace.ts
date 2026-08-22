import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

import type { Page } from '@playwright/test'

const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'blink.user_timing',
  'latencyInfo',
  'input',
  'toplevel',
  'cc',
  'gpu',
  'v8'
]

export interface ChromiumTraceCapture {
  stop: (path: string) => Promise<void>
}

export interface ChromiumTraceOptions {
  cpuProfile?: boolean
}

export async function startChromiumTrace(
  page: Page,
  options: ChromiumTraceOptions = {}
): Promise<ChromiumTraceCapture> {
  const categories = options.cpuProfile
    ? [...TRACE_CATEGORIES, 'disabled-by-default-v8.cpu_profiler']
    : TRACE_CATEGORIES
  const session = await page.context().newCDPSession(page)
  const chunks: string[] = []
  session.on('Tracing.dataCollected', ({ value }) => chunks.push(...value.map(JSON.stringify)))
  await session.send('Tracing.start', {
    categories: categories.join(','),
    transferMode: 'ReportEvents',
    options: 'sampling-frequency=10000'
  })

  return {
    async stop(path) {
      const complete = new Promise<void>((resolve) => {
        session.once('Tracing.tracingComplete', () => resolve())
      })
      await session.send('Tracing.end')
      await complete
      const trace = `{"traceEvents":[${chunks.join(',')}],"displayTimeUnit":"ms"}`
      await writeFile(path, gzipSync(trace))
      await session.detach()
    }
  }
}
