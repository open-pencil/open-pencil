import { createApp } from 'vue'

import '@/app.css'
import { utcToday } from '@/app/metrics/days'
import { fetchMetricsSnapshot } from '@/app/metrics/load'
import { presetRange } from '@/app/metrics/range'
import MetricsView from '@/views/metrics/MetricsView.vue'

// Entry for the team's metrics dashboard (`metrics.html`). Only the feedback Worker serves it,
// under /admin behind Cloudflare Access; the editor never loads it.
async function start(): Promise<void> {
  const initialRange = presetRange('7d', utcToday().toString())
  // The splash in metrics.html covers the first request; the page mounts with its answer.
  const initialSnapshot = await fetchMetricsSnapshot(initialRange).catch((error: unknown) => {
    console.warn('Metrics could not load', error)
    return undefined
  })
  const app = createApp(MetricsView, { initialRange, initialSnapshot })
  app.config.errorHandler = (error) => {
    console.error(error)
  }
  app.mount('#app')
}

void start()
