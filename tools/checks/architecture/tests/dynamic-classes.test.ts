import { describe, expect, test } from 'bun:test'

import {
  dynamicClassDiagnostics,
  vueTemplateGuardrailDiagnostics
} from '../src/steiger-rules/dynamic-tailwind-classes'

function component(classBinding: string) {
  return `<template><button :class="${classBinding}" /></template>`
}

describe('Vue template UI guardrails', () => {
  test('reports use*UI calls inside bindings', () => {
    const source = `<template><button :class="useButtonUI({ tone: 'accent' }).base" /></template>`
    expect(vueTemplateGuardrailDiagnostics('src/components/Test.vue', source)).toHaveLength(1)
  })

  test('reports raw SVG elements and permits icon components', () => {
    expect(
      vueTemplateGuardrailDiagnostics(
        'src/components/Test.vue',
        '<template><div><svg /><icon-lucide-check /></div></template>'
      )
    ).toHaveLength(1)
  })
})

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

  test('rejects dynamic utility state in previously audited files', () => {
    const audited = `<template>${'\n'.repeat(36)}<button :class="active ? 'bg-hover' : 'text-muted'" /></template>`
    expect(
      dynamicClassDiagnostics('src/components/CollabPanel/CollabAvatarStack.vue', audited)
    ).toHaveLength(1)
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
