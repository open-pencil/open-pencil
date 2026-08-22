import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from '@playwright/test'

import { startChromiumTrace } from './chromium-trace'
import { compareNavigationMetrics } from './compare'
import { computeNavigationMetrics } from './metrics'
import { readRecording } from './recording'
import { replay, type ReplayMode } from './replay'
import { setupScenario, type NavigationScenario } from './scenario'
import type { NavigationMetrics, NavigationRecordingFile } from './types'

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? fallback : process.argv[index + 1]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const command = process.argv[2]
if (command === 'compare') {
  const baseline = JSON.parse(await readFile(argument('--baseline'), 'utf8')) as NavigationMetrics
  const candidate = JSON.parse(await readFile(argument('--candidate'), 'utf8')) as NavigationMetrics
  const comparison = compareNavigationMetrics(baseline, candidate)
  const comparisonOutput = process.argv.includes('--output') ? argument('--output') : null
  if (comparisonOutput) await writeFile(comparisonOutput, JSON.stringify(comparison, null, 2))
  console.log(JSON.stringify(comparison, null, 2))
  process.exit(0)
}
if (command !== 'run') {
  console.log(
    'Usage: bun tools/navigation-benchmark/src/cli.ts run --url URL --gesture FILE [--mode cdp|dom] [--scenario light|large-flat|raster-stress|current-document] [--document FILE] [--no-trace] [--cpu-profile] [--software-gpu] [--output DIR]\n       bun tools/navigation-benchmark/src/cli.ts compare --baseline METRICS --candidate METRICS [--output FILE]'
  )
  process.exit(command ? 1 : 0)
}

const url = argument('--url')
const gesturePath = argument('--gesture')
const mode = argument('--mode', 'cdp') as ReplayMode
const scenario = argument('--scenario', 'light') as NavigationScenario
const documentPath = process.argv.includes('--document') ? resolve(argument('--document')) : null
const mutationNodeId = process.argv.includes('--mutate-node') ? argument('--mutate-node') : null
const mutationOpacity = process.argv.includes('--mutate-opacity')
  ? Number(argument('--mutate-opacity'))
  : null
const traceEnabled = !process.argv.includes('--no-trace')
const cpuProfile = process.argv.includes('--cpu-profile')
const softwareGpu = process.argv.includes('--software-gpu')
const output = resolve(argument('--output', 'artifacts/navigation-benchmark'))
if (mode !== 'cdp' && mode !== 'dom') throw new Error(`Unsupported replay mode: ${mode}`)
if (!['light', 'large-flat', 'raster-stress', 'current-document'].includes(scenario)) {
  throw new Error(`Unsupported scenario: ${scenario}`)
}

if (scenario === 'current-document' && !documentPath) {
  throw new Error('--document is required with --scenario current-document')
}
if (scenario !== 'current-document' && documentPath) {
  throw new Error('--document requires --scenario current-document')
}

if (mutationOpacity !== null && (!Number.isFinite(mutationOpacity) || !mutationNodeId)) {
  throw new Error('--mutate-opacity requires a finite value and --mutate-node')
}

await mkdir(output, { recursive: true })
const input = await readRecording(gesturePath)
function hardwareGpuArgs(): string[] {
  const base = ['--ignore-gpu-blocklist', '--enable-gpu']
  return process.platform === 'darwin' ? [...base, '--use-angle=metal'] : base
}

const browser = await chromium.launch({
  headless: true,
  args: softwareGpu ? ['--enable-unsafe-swiftshader'] : hardwareGpuArgs()
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2
})
const page = await context.newPage()
const documentURLPath = '/__navigation-benchmark-document.fig'
if (documentPath) {
  const documentBytes = await readFile(documentPath)
  await page.route(`**${documentURLPath}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: documentBytes
    })
  )
}

try {
  await page.goto(
    `${url}${url.includes('?') ? '&' : '?'}test&no-chrome&no-rulers&navigation-benchmark`
  )
  const glInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { renderer: 'unavailable', vendor: 'unavailable' }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: String(
        gl.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) ?? 'unknown'
      ),
      vendor: String(gl.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) ?? 'unknown')
    }
  })
  if (!softwareGpu && /SwiftShader/i.test(glInfo.renderer)) {
    throw new Error(`Hardware GPU benchmark requested but Chromium uses ${glInfo.renderer}`)
  }
  await page.locator('[data-test-id="canvas-element"][data-ready="1"]').waitFor({ timeout: 30_000 })
  if (documentPath) {
    await page.evaluate((path) => window.openPencil?.openFile?.(path), documentURLPath)
    await page.waitForFunction(
      () => {
        const store = window.openPencil?.getStore?.()
        return (
          store != null &&
          !store.state.loading &&
          store.graph.getChildren(store.state.currentPageId).length > 0
        )
      },
      undefined,
      { timeout: 90_000 }
    )
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not available after opening benchmark document')
      store.zoomToFit()
    })
  } else {
    await setupScenario(page, scenario)
  }
  await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
  if (!documentPath) {
    await page.evaluate((viewport) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not available')
      store.state.panX = viewport.panX
      store.state.panY = viewport.panY
      store.state.zoom = viewport.zoom
      store.requestRepaint()
    }, input.initialViewport)
  }
  await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
  await page.evaluate(
    (name) => window.openPencil?.test?.navigation?.startRecording(name),
    input.name
  )

  const trace = traceEnabled ? await startChromiumTrace(page, { cpuProfile }) : null
  if (mutationNodeId && mutationOpacity !== null) {
    await page.evaluate(
      ({ nodeId, opacity }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not available for benchmark mutation')
        if (!store.graph.getNode(nodeId))
          throw new Error(`Benchmark mutation node not found: ${nodeId}`)
        store.graph.updateNode(nodeId, { opacity })
      },
      { nodeId: mutationNodeId, opacity: mutationOpacity }
    )
  } else {
    await replay(page, input, mode)
  }
  await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
  await trace?.stop(resolve(output, 'trace.json.gz'))

  const recording = await page.evaluate(
    () => window.openPencil?.test?.navigation?.stopRecording() as NavigationRecordingFile
  )
  const metrics = computeNavigationMetrics(recording)
  const environment = {
    url,
    mode,
    scenario,
    traceEnabled,
    cpuProfile,
    softwareGpu,
    glInfo,
    documentPath,
    mutationNodeId,
    mutationOpacity,
    gesturePath: resolve(gesturePath),
    browserVersion: await browser.version(),
    platform: process.platform,
    arch: process.arch,
    bunVersion: Bun.version,
    recordedAt: new Date().toISOString()
  }
  await Promise.all([
    writeFile(resolve(output, 'recording.json'), JSON.stringify(recording, null, 2)),
    writeFile(resolve(output, 'metrics.json'), JSON.stringify(metrics, null, 2)),
    writeFile(resolve(output, 'environment.json'), JSON.stringify(environment, null, 2))
  ])
  console.log(JSON.stringify(metrics, null, 2))
} finally {
  await context.close()
  await browser.close()
}
