import { describe, expect, test } from 'bun:test'

import { createHeadlessCSSRuntime, htmlToDesignDocument, type CSSRuntime } from '#dom-css/index'

/** A runtime that records the CSS it is asked to apply. */
function recordingRuntime(sheets: string[]): CSSRuntime {
  const runtime = createHeadlessCSSRuntime()
  return {
    ...runtime,
    computeStyles: async (document, cssText = '') => {
      sheets.push(cssText)
      return document
    }
  }
}

describe('linked stylesheets', () => {
  const page = `<head>
    <link rel="stylesheet" href="site.css">
    <link rel="stylesheet" href="print.css" media="print">
    <link rel="stylesheet" href="wide.css" media="screen and (min-width: 800px)">
    <link rel="stylesheet" href="evil.css" media="all;} body { display: none">
    <link rel="alternate stylesheet" href="dark.css">
    <link rel="icon" href="icon.png">
    <style>.card { color: red }</style>
  </head><body><div class="card"></div></body>`

  test('become @import rules with their media ahead of the page CSS when asked', async () => {
    const sheets: string[] = []
    await htmlToDesignDocument(page, {
      runtime: recordingRuntime(sheets),
      importLinkedStylesheets: true,
      cssText: '.extra { color: blue }'
    })

    expect(sheets[0]?.split('\n')).toEqual([
      '@import url("site.css");',
      '@import url("print.css") print;',
      '@import url("wide.css") screen and (min-width: 800px);',
      '.card { color: red }',
      '.extra { color: blue }'
    ])
  })

  test('are left out otherwise', async () => {
    const sheets: string[] = []
    await htmlToDesignDocument(page, { runtime: recordingRuntime(sheets) })

    expect(sheets[0]).toBe('.card { color: red }')
  })
})
