import { describe, expect, test } from 'bun:test'

import { parseFontFaceRules } from '#dom-css/import/font-faces'

describe('@font-face rules', () => {
  test('read each rule with its sources resolved against the stylesheet', () => {
    const rules = parseFontFaceRules(
      `@font-face {
        font-family: "Brand Sans";
        src: url(fonts/brand.woff2) format("woff2"), url('fonts/brand.ttf');
        font-weight: bold;
        font-style: italic;
      }
      @media screen { @font-face { font-family: Other; src: url(/other.ttf) } }
      .card { color: red }`,
      'https://example.com/css/site.css'
    )

    expect(rules).toEqual([
      {
        family: 'Brand Sans',
        weight: 700,
        italic: true,
        sources: [
          'https://example.com/css/fonts/brand.woff2',
          'https://example.com/css/fonts/brand.ttf'
        ]
      },
      { family: 'Other', weight: 400, italic: false, sources: ['https://example.com/other.ttf'] }
    ])
  })

  test('register a variable font at the regular weight its range holds', () => {
    const [variable, light] = parseFontFaceRules(
      `@font-face { font-family: V; src: url(v.ttf); font-weight: 100 900 }
      @font-face { font-family: L; src: url(l.ttf); font-weight: 100 300 }`,
      'https://example.com/'
    )

    expect([variable?.weight, light?.weight]).toEqual([400, 300])
  })

  test('leave out a rule without a family or a source', () => {
    expect(
      parseFontFaceRules('@font-face { font-family: A } @font-face { src: url(b.ttf) }')
    ).toEqual([])
  })
})
