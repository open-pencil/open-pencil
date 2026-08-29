#!/usr/bin/env bun

import { mkdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { chromium, type Page } from '@playwright/test'
import { $ } from 'bun'

import { readVisualOracleManifest, type VisualOracleTarget } from '../document/manifest'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o' },
    headed: { type: 'boolean', default: false },
    'skip-figma-export': { type: 'boolean', default: false }
  }
})
const manifestPath = positionals[0]
if (!manifestPath) {
  console.error(
    'Usage: bun tools/visual-oracles/src/cli.ts compare document manifest.json [--output DIR]'
  )
  process.exit(1)
}
const manifest = readVisualOracleManifest(manifestPath)
const outputDir = resolve(values.output ?? manifest.output ?? '/tmp/open-pencil-document-oracle')
mkdirSync(outputDir, { recursive: true })
const bytes = await Bun.file(resolve(manifest.document)).bytes()
const browser = await chromium.launch({ headless: !values.headed })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true
})
const page = await context.newPage()
const documentPath = '/__visual-oracle-document.fig'
await page.route(`**${documentPath}`, (route) =>
  route.fulfill({ status: 200, contentType: 'application/octet-stream', body: bytes })
)

let failed = false
try {
  await page.goto(
    `${manifest.appURL}${manifest.appURL.includes('?') ? '&' : '?'}test&no-chrome&no-rulers&navigation-benchmark`
  )
  await page.locator('[data-test-id="canvas-element"][data-ready="1"]').waitFor({ timeout: 30_000 })
  await page.evaluate((path) => window.openPencil?.openFile?.(path), documentPath)
  await page.waitForFunction(
    () => window.openPencil?.getStore?.().state.preparation == null,
    undefined,
    {
      timeout: 120_000
    }
  )

  for (const target of manifest.targets) {
    const result = await compareTarget(page, target)
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${target.page} / ${target.node}`)
    console.log(`  ${result.differentPercent.toFixed(3)}% pixels differ (${result.fuzz} fuzz)`)
    if (!result.passed) failed = true
  }
} finally {
  await browser.close()
}
if (failed) process.exit(1)

async function compareTarget(page: Page, target: VisualOracleTarget) {
  console.log(`Comparing ${target.page} / ${target.node}`)
  const stem = `${sanitize(target.page)}--${sanitize(target.node)}`
  const targetDir = `${outputDir}/${stem}`
  mkdirSync(targetDir, { recursive: true })
  const figmaPath = `${targetDir}/figma.png`
  const openPencilPath = `${targetDir}/openpencil.png`
  const normalizedPath = `${targetDir}/openpencil-normalized.png`
  const diffPath = `${targetDir}/diff.png`
  const heatmapPath = `${targetDir}/heatmap.png`
  const scale = target.scale ?? 1
  if (!values['skip-figma-export']) {
    await $`figma-use export node ${target.figmaNodeId} --output ${figmaPath} --scale ${String(scale)}`.quiet()
  }

  const metadata = await captureOpenPencilTarget(page, target, openPencilPath, scale)
  if (metadata.pageRoots < (target.minimumPageRoots ?? 1)) {
    throw new Error(
      `${target.page} has ${metadata.pageRoots} roots; expected at least ${target.minimumPageRoots ?? 1}`
    )
  }
  if (target.expectedWidth !== undefined && metadata.width !== target.expectedWidth) {
    throw new Error(`${target.node} width ${metadata.width}; expected ${target.expectedWidth}`)
  }
  if (target.expectedHeight !== undefined && metadata.height !== target.expectedHeight) {
    throw new Error(`${target.node} height ${metadata.height}; expected ${target.expectedHeight}`)
  }

  const figmaSize = await imageSize(figmaPath)
  const openPencilSize = await imageSize(openPencilPath)
  const comparePath = figmaSize === openPencilSize ? openPencilPath : normalizedPath
  if (comparePath === normalizedPath) {
    await $`magick ${openPencilPath} -background none -gravity northwest -extent ${figmaSize} ${normalizedPath}`.quiet()
  }
  const fuzz = target.fuzz ?? '2%'
  const difference =
    await $`magick compare -metric AE -fuzz ${fuzz} ${figmaPath} ${comparePath} null:`
      .quiet()
      .nothrow()
  const pixels = Number.parseInt(difference.stderr.toString().trim(), 10) || 0
  const [width, height] = figmaSize.split('x').map(Number)
  const total = width * height
  const differentPercent = total > 0 ? (pixels / total) * 100 : 100
  await $`magick compare -highlight-color red -lowlight-color '#FFFFFF22' ${figmaPath} ${comparePath} ${diffPath}`
    .quiet()
    .nothrow()
  await $`magick ${diffPath} -filter point -resize 400% ${heatmapPath}`.quiet()
  const maximum = target.maximumDifferentPercent ?? 10
  const metrics = {
    target,
    figmaSize,
    openPencilSize,
    metadata,
    fuzz,
    differentPixels: pixels,
    differentPercent,
    maximumDifferentPercent: maximum,
    passed: differentPercent <= maximum
  }
  await Bun.write(`${targetDir}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`)
  return metrics
}

async function captureOpenPencilTarget(
  page: Page,
  target: VisualOracleTarget,
  outputPath: string,
  scale: number
) {
  const metadata = await page.evaluate(
    async ({ target, scale }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store unavailable')
      const pageNode = store.graph.getPages().find((candidate) => candidate.name === target.page)
      if (!pageNode) throw new Error(`OpenPencil page missing: ${target.page}`)
      await store.switchPage(pageNode.id)
      const pageRoots = store.graph.getChildren(pageNode.id)
      const node = target.openPencilNodeId
        ? store.graph.getNode(target.openPencilNodeId)
        : store.graph
            .getAllNodes()
            .find(
              (candidate) => candidate.name === target.node && candidate.parentId === pageNode.id
            )
      if (!node || node.parentId !== pageNode.id) {
        throw new Error(`OpenPencil node missing from page: ${target.page} / ${target.node}`)
      }
      const position = store.graph.getAbsolutePosition(node.id)
      const viewportWidth = 1280
      const viewportHeight = 800
      store.state.zoom = scale
      store.state.panX = viewportWidth / 2 - (position.x + node.width / 2) * scale
      store.state.panY = viewportHeight / 2 - (position.y + node.height / 2) * scale
      store.requestRepaint()
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolveFrame())
        })
      })
      await window.openPencil?.test?.navigation?.waitForSettlement()
      return {
        pageId: pageNode.id,
        nodeId: node.id,
        pageRoots: pageRoots.length,
        width: node.width,
        height: node.height,
        clip: {
          x: viewportWidth / 2 - (node.width * scale) / 2,
          y: viewportHeight / 2 - (node.height * scale) / 2,
          width: node.width * scale,
          height: node.height * scale
        }
      }
    },
    { target, scale }
  )
  await page.screenshot({ path: outputPath, clip: metadata.clip })
  return metadata
}

async function imageSize(path: string): Promise<string> {
  return (await $`identify -format '%wx%h' ${path}`.quiet()).text().trim()
}

function sanitize(value: string): string {
  return value
    .replaceAll(/[^A-Za-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase()
}

console.log(`Compared ${manifest.targets.length} targets from ${basename(manifest.document)}`)
