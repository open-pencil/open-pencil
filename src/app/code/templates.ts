export type CodeSource = 'design-jsx' | 'tailwind-jsx' | 'html-css'

export const DESIGN_JSX_STARTER_SOURCE = '<Frame name="New frame" w={320} h={240} fill="#ffffff" />'

export const HTML_CSS_STARTER_SOURCE = `<style>
  .card {
    padding: 16px;
    border-radius: 12px;
    background: white;
  }
</style>

<div class="card">Hello</div>`

export function starterSourceFor(language: CodeSource): string {
  return language === 'html-css' ? HTML_CSS_STARTER_SOURCE : DESIGN_JSX_STARTER_SOURCE
}
