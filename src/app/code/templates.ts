import type { ComponentStyling } from '@open-pencil/dom-css/export'

export type CodeSource = 'design-jsx' | 'html-css' | 'vue' | 'react'

export const DESIGN_JSX_STARTER_SOURCE = '<Frame name="New frame" w={320} h={240} fill="#ffffff" />'

export const HTML_CSS_STARTER_SOURCE = `<style>
  .card {
    padding: 16px;
    border-radius: 12px;
    background: white;
  }
</style>

<div class="card">Hello</div>`

export const HTML_TAILWIND_STARTER_SOURCE = '<div class="rounded-xl bg-white p-4">Hello</div>'

export function starterSourceFor(language: CodeSource, styling: ComponentStyling = 'css'): string {
  if (language !== 'html-css') return DESIGN_JSX_STARTER_SOURCE
  return styling === 'tailwind' ? HTML_TAILWIND_STARTER_SOURCE : HTML_CSS_STARTER_SOURCE
}
