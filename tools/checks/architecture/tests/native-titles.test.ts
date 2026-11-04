import { describe, expect, test } from 'bun:test'

import { nativeTitles } from '../src/steiger-rules/native-titles'

const sfc = (template: string, script = '') =>
  `<script setup lang="ts">\n${script}\n</script>\n<template>\n${template}\n</template>\n`

describe('native titles in Vue templates', () => {
  test('finds title attributes and bindings on elements and app components', () => {
    const content = sfc(
      `<div title="Hint"><span :title="hint" /><MetricsCard title="Visits" /></div>`,
      "import MetricsCard from './MetricsCard.vue'"
    )
    expect(nativeTitles('src/components/Example.vue', content)).toHaveLength(3)
  })

  test("allows a vccs chart's title, which is its accessible name", () => {
    const content = sfc(
      `<BarChart title="Daily installs"><Bar /></BarChart><Sparkline :title="label" />`,
      "import { Bar, BarChart, Sparkline } from 'vccs'"
    )
    expect(nativeTitles('src/components/metrics/Chart.vue', content)).toEqual([])
  })

  test('a component with a chart name from elsewhere is still checked', () => {
    const content = sfc(
      `<BarChart title="Daily installs" />`,
      "import BarChart from './BarChart.vue'"
    )
    expect(nativeTitles('src/components/metrics/Chart.vue', content)).toHaveLength(1)
  })

  test('only checks app and SDK Vue files', () => {
    expect(nativeTitles('packages/docs/Example.vue', sfc(`<div title="Hint" />`))).toEqual([])
    expect(nativeTitles('src/app/example.ts', 'const title = 1')).toEqual([])
  })
})
