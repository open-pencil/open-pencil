import { describe, expect, test } from 'bun:test'

import { dynamicClassDiagnostics } from '../src/steiger-rules/dynamic-tailwind-classes'

function component(classBinding: string) {
  return `<template><button :class="${classBinding}" /></template>`
}

describe('dynamic Tailwind state classes', () => {
  test('reports conditional utility strings', () => {
    const diagnostics = dynamicClassDiagnostics(
      'src/components/example/ExampleButton.vue',
      component("active ? 'bg-accent text-white' : 'text-muted'")
    )
    expect(diagnostics).toHaveLength(1)
  })

  test('reports object-style utility maps', () => {
    const diagnostics = dynamicClassDiagnostics(
      'src/components/example/ExampleButton.vue',
      component("{ 'opacity-50': disabled }")
    )
    expect(diagnostics).toHaveLength(1)
  })

  test('allows only audited locations inside legacy files', () => {
    const audited = `<template>${'\n'.repeat(19)}<button :class="active ? 'bg-hover' : 'text-muted'" /></template>`
    expect(dynamicClassDiagnostics('src/components/Toolbar/ToolButton.vue', audited)).toEqual([])
    expect(
      dynamicClassDiagnostics(
        'src/components/LayersPanel.vue',
        component("active ? 'bg-hover' : 'text-muted'")
      )
    ).toHaveLength(1)
  })

  test('allows resolved theme slots and semantic state', () => {
    const source = `<template><button :data-active="active || undefined" :class="styles.button({ class: ui?.button })" /></template>`
    expect(dynamicClassDiagnostics('src/components/example/ExampleButton.vue', source)).toEqual([])
  })

  test('ignores static classes', () => {
    expect(
      dynamicClassDiagnostics(
        'src/components/example/ExampleButton.vue',
        '<template><button class="bg-transparent text-muted hover:bg-hover" /></template>'
      )
    ).toEqual([])
  })
})
