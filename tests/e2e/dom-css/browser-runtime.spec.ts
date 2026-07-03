import {
  compileTailwindCSS,
  designDocumentToSceneGraph,
  jsx,
  jsxToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css'

import {
  DOM_CSS_COLORS,
  fixtureMatrixCSS,
  fixtureMatrixHTML,
  tailwindBadgeClasses,
  tailwindButtonClasses,
  tailwindCardClasses,
  tailwindInputClasses,
  tailwindNavClasses
} from '#tests/helpers/dom-css'
import {
  browserRuntimeComputeStyles,
  computedStyleProperties,
  publicBrowserHTMLSceneGraph,
  publicBrowserSceneGraph,
  publicBrowserTextNode,
  setStyledContent
} from '#tests/helpers/dom-css-browser'

import { expect, test } from '../fixtures'

test.describe('@open-pencil/dom-css browser CSS runtime oracle', () => {
  test('resolves Tailwind card variables and calc values in a real browser', async ({ page }) => {
    const css = await compileTailwindCSS(tailwindCardClasses)
    await setStyledContent(
      page,
      css,
      `<article class="${tailwindCardClasses.join(' ')}"><h1>OpenPencil</h1></article>`
    )

    const styles = await computedStyleProperties(page, 'article', [
      'background-color',
      'border-radius',
      'color',
      'display',
      'flex-direction',
      'gap',
      'height',
      'padding-top',
      'width'
    ])

    expect(styles.display).toBe('flex')
    expect(styles['flex-direction']).toBe('column')
    expect(styles.gap).toBe('12px')
    expect(styles.width).toBe('320px')
    expect(styles.height).toBe('176px')
    expect(styles['padding-top']).toBe('24px')
    expect(styles['border-radius']).toBe('12px')
    expect(styles['background-color']).toBe('rgb(255, 255, 255)')
    expect(styles.color).toMatch(/^(oklch|rgb)\(/)
  })

  test('resolves Tailwind button alignment, spacing, and typography', async ({ page }) => {
    const css = await compileTailwindCSS(tailwindButtonClasses)
    await setStyledContent(
      page,
      css,
      `<button class="${tailwindButtonClasses.join(' ')}">Create design</button>`
    )

    const styles = await computedStyleProperties(page, 'button', [
      'align-items',
      'border-radius',
      'color',
      'display',
      'font-size',
      'font-weight',
      'gap',
      'justify-content',
      'padding-left',
      'padding-top'
    ])

    expect(styles.display).toBe('inline-flex')
    expect(styles['align-items']).toBe('center')
    expect(styles['justify-content']).toBe('center')
    expect(styles.gap).toBe('8px')
    expect(styles['padding-left']).toBe('16px')
    expect(styles['padding-top']).toBe('8px')
    expect(styles['font-size']).toBe('14px')
    expect(styles['font-weight']).toBe('500')
    expect(styles['border-radius']).toBe('6px')
    expect(styles.color).toBe('rgb(255, 255, 255)')
  })

  test('resolves fixture matrix layout, form, badge, and dialog styles', async ({ page }) => {
    await setStyledContent(page, fixtureMatrixCSS, fixtureMatrixHTML)

    const navbar = await computedStyleProperties(page, '.navbar', [
      'align-items',
      'border-radius',
      'display',
      'height',
      'justify-content',
      'padding-left',
      'width'
    ])
    expect(navbar.display).toBe('flex')
    expect(navbar['align-items']).toBe('center')
    expect(navbar['justify-content']).toBe('space-between')
    expect(navbar.width).toBe('416px')
    expect(navbar.height).toBe('48px')
    expect(navbar['padding-left']).toBe('16px')
    expect(navbar['border-radius']).toBe('12px')

    const badge = await computedStyleProperties(page, '.badge', [
      'align-items',
      'background-color',
      'border-radius',
      'color',
      'display',
      'font-size',
      'font-weight',
      'height',
      'justify-content',
      'padding-left'
    ])
    expect(badge.display).toBe('flex')
    expect(badge['align-items']).toBe('center')
    expect(badge['justify-content']).toBe('center')
    expect(badge.height).toBe('24px')
    expect(badge['padding-left']).toBe('10px')
    expect(badge['border-radius']).toBe('9999px')
    expect(badge['font-size']).toBe('12px')
    expect(badge['font-weight']).toBe('600')
    expect(badge['background-color']).toBe('rgb(224, 242, 254)')
    expect(badge.color).toBe('rgb(3, 105, 161)')

    const input = await computedStyleProperties(page, '.input', [
      'border-bottom-width',
      'border-radius',
      'font-size',
      'height',
      'padding-left',
      'width'
    ])
    expect(input.width).toBe('312px')
    expect(input.height).toBe('40px')
    expect(input['padding-left']).toBe('12px')
    expect(input['border-radius']).toBe('8px')
    expect(input['border-bottom-width']).toBe('1px')
    expect(input['font-size']).toBe('14px')

    const dialog = await computedStyleProperties(page, '.dialog', [
      'box-shadow',
      'display',
      'flex-direction',
      'gap',
      'max-width',
      'min-width',
      'padding-top',
      'width'
    ])
    expect(dialog.display).toBe('flex')
    expect(dialog['flex-direction']).toBe('column')
    expect(dialog.gap).toBe('16px')
    expect(dialog.width).toBe('360px')
    expect(dialog['min-width']).toBe('320px')
    expect(dialog['max-width']).toBe('420px')
    expect(dialog['padding-top']).toBe('24px')
    expect(dialog['box-shadow']).toContain('rgba(15, 23, 42, 0.16)')
  })

  test('resolves Tailwind input, badge, and nav utilities in a real browser', async ({ page }) => {
    const inputClasses = [...tailwindInputClasses]
    const badgeClasses = [...tailwindBadgeClasses]
    const navClasses = [...tailwindNavClasses]
    const css = await compileTailwindCSS([...inputClasses, ...badgeClasses, ...navClasses])
    await setStyledContent(
      page,
      css,
      `
        <nav class="${navClasses.join(' ')}">
          <span>OpenPencil</span>
          <span class="${badgeClasses.join(' ')}">Beta</span>
        </nav>
        <input class="${inputClasses.join(' ')}" value="https://openpencil.dev" />
      `
    )

    const nav = await computedStyleProperties(page, 'nav', [
      'align-items',
      'border-radius',
      'display',
      'height',
      'justify-content',
      'padding-left',
      'width'
    ])
    expect(nav.display).toBe('flex')
    expect(nav['align-items']).toBe('center')
    expect(nav['justify-content']).toBe('space-between')
    expect(nav.width).toBe('384px')
    expect(nav.height).toBe('48px')
    expect(nav['padding-left']).toBe('16px')
    expect(nav['border-radius']).toBe('12px')

    const badge = await computedStyleProperties(page, 'nav span:last-child', [
      'align-items',
      'border-radius',
      'display',
      'font-size',
      'font-weight',
      'height',
      'justify-content',
      'padding-left'
    ])
    expect(badge.display).toBe('flex')
    expect(badge['align-items']).toBe('center')
    expect(badge['justify-content']).toBe('center')
    expect(badge.height).toBe('24px')
    expect(badge['padding-left']).toBe('10px')
    expect(badge['border-radius']).toMatch(/^3\.\d+e\+\d+px$/)
    expect(badge['font-size']).toBe('12px')
    expect(badge['font-weight']).toBe('600')

    const input = await computedStyleProperties(page, 'input', [
      'border-bottom-width',
      'border-radius',
      'font-size',
      'height',
      'padding-left',
      'width'
    ])
    expect(input.width).toBe('320px')
    expect(input.height).toBe('40px')
    expect(input['padding-left']).toBe('12px')
    expect(input['border-radius']).toBe('6px')
    expect(input['border-bottom-width']).toBe('1px')
    expect(input['font-size']).toBe('14px')
  })

  test('resolves custom properties when assigned to real CSS properties', async ({ page }) => {
    await page.setContent(`
      <style>
        :root {
          --spacing: 0.25rem;
          --fallback-width: 10rem;
        }
        .card {
          --card-gap: calc(var(--spacing) * 3);
          --card-width: var(--missing-width, var(--fallback-width));
          display: flex;
          gap: var(--card-gap);
          width: calc(var(--card-width) + 16px);
          padding: calc(var(--spacing) * 6);
        }
      </style>
      <section class="card"><h1>Title</h1></section>
    `)

    const styles = await page.locator('.card').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        customGap: computed.getPropertyValue('--card-gap'),
        gap: computed.getPropertyValue('gap'),
        paddingTop: computed.getPropertyValue('padding-top'),
        width: computed.getPropertyValue('width')
      }
    })

    expect(styles.customGap).toContain('calc')
    expect(styles.gap).toBe('12px')
    expect(styles.paddingTop).toBe('24px')
    expect(styles.width).toBe('176px')
  })

  test('resolves border styles in a real browser', async ({ page }) => {
    await setStyledContent(
      page,
      `
        .outline {
          border: 2px dashed #0f172a;
          width: 160px;
          height: 80px;
        }
      `,
      '<div class="outline"></div>'
    )

    const outline = await computedStyleProperties(page, '.outline', [
      'border-bottom-color',
      'border-bottom-style',
      'border-bottom-width',
      'height',
      'width'
    ])
    expect(outline['border-bottom-color']).toBe('rgb(15, 23, 42)')
    expect(outline['border-bottom-style']).toBe('dashed')
    expect(outline['border-bottom-width']).toBe('2px')
    expect(outline.width).toBe('160px')
    expect(outline.height).toBe('80px')
  })

  test('resolves aspect ratio, object fit, text transform, and white space in a real browser', async ({
    page
  }) => {
    await setStyledContent(
      page,
      `
        .ratio {
          aspect-ratio: 16 / 9;
          width: 320px;
        }
        .media {
          object-fit: contain;
          width: 320px;
          height: 180px;
        }
        .title {
          text-transform: uppercase;
          white-space: nowrap;
        }
      `,
      '<div class="ratio"></div><img class="media" alt="Preview" /><h1 class="title">OpenPencil</h1>'
    )

    const ratio = await computedStyleProperties(page, '.ratio', ['aspect-ratio', 'height', 'width'])
    expect(ratio['aspect-ratio']).toBe('16 / 9')
    expect(ratio.width).toBe('320px')
    expect(ratio.height).toBe('180px')

    const media = await computedStyleProperties(page, '.media', ['height', 'object-fit', 'width'])
    expect(media['object-fit']).toBe('contain')
    expect(media.width).toBe('320px')
    expect(media.height).toBe('180px')

    const title = await computedStyleProperties(page, '.title', ['text-transform', 'white-space'])
    expect(title['text-transform']).toBe('uppercase')
    expect(title['white-space']).toBe('nowrap')
  })

  test('projects browser text transform and nowrap into scene graph text fields', async ({
    page
  }) => {
    const textNode = await publicBrowserTextNode(
      page,
      '<h1 class="title">OpenPencil</h1>',
      '.title { color: #111827; text-transform: uppercase; white-space: nowrap; }'
    )

    expect(textNode?.type).toBe('TEXT')
    expect(textNode?.textCase).toBe('UPPER')
    expect(textNode?.maxLines).toBe(1)
  })

  test('resolves flex wrap, self alignment, absolute positioning, and clipping', async ({
    page
  }) => {
    await setStyledContent(
      page,
      `
        .wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
          overflow: clip;
          position: relative;
          width: 240px;
          height: 120px;
        }
        .chip {
          align-self: center;
          position: absolute;
          left: 16px;
          top: 24px;
          min-width: 48px;
          max-width: 96px;
          width: 80px;
          height: 32px;
        }
      `,
      '<section class="wrap"><div class="chip">Chip</div></section>'
    )

    const wrap = await computedStyleProperties(page, '.wrap', [
      'column-gap',
      'display',
      'flex-wrap',
      'height',
      'overflow',
      'position',
      'row-gap',
      'width'
    ])
    expect(wrap.display).toBe('flex')
    expect(wrap['flex-wrap']).toBe('wrap')
    expect(wrap['column-gap']).toBe('20px')
    expect(wrap['row-gap']).toBe('12px')
    expect(wrap.overflow).toBe('clip')
    expect(wrap.position).toBe('relative')
    expect(wrap.width).toBe('240px')
    expect(wrap.height).toBe('120px')

    const chip = await computedStyleProperties(page, '.chip', [
      'align-self',
      'height',
      'left',
      'max-width',
      'min-width',
      'position',
      'top',
      'width'
    ])
    expect(chip['align-self']).toBe('center')
    expect(chip.position).toBe('absolute')
    expect(chip.left).toBe('16px')
    expect(chip.top).toBe('24px')
    expect(chip['min-width']).toBe('48px')
    expect(chip['max-width']).toBe('96px')
    expect(chip.width).toBe('80px')
    expect(chip.height).toBe('32px')
  })

  test('computes styles through the browser runtime sandbox', async ({ page }) => {
    await page.goto('/')
    await setStyledContent(page, '.card { width: 20px; }', '<article class="card">Host</article>')
    const document: DesignDocument = {
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'article',
          attrs: { class: 'card' },
          children: [{ type: 'text', text: 'OpenPencil' }]
        }
      ]
    }
    const css = `
      :root { --spacing: 0.25rem; }
      .card {
        display: flex;
        flex-direction: column;
        gap: calc(var(--spacing) * 3);
        width: calc(10rem + 16px);
        padding: calc(var(--spacing) * 6);
        box-shadow: 0px 8px 24px 0px ${DOM_CSS_COLORS.dialogShadow};
      }
    `

    const iframeDocument = await browserRuntimeComputeStyles(page, document, css, 'iframe')
    const shadowDocument = await browserRuntimeComputeStyles(page, document, css, 'shadow-root')
    const iframeCard = iframeDocument.children[0]
    const shadowCard = shadowDocument.children[0]

    expect(iframeCard?.type).toBe('element')
    expect(shadowCard?.type).toBe('element')
    if (iframeCard?.type !== 'element' || shadowCard?.type !== 'element') return
    expect(iframeCard.computedStyle?.width).toBe('176px')
    expect(shadowCard.computedStyle?.width).toBe('176px')
    expect(iframeCard.computedStyle?.gap).toBe('12px')
    expect(iframeCard.computedStyle?.['padding-top']).toBe('24px')
    expect(iframeCard.computedStyle?.['box-shadow']).toContain('rgba(15, 23, 42, 0.16)')

    const hostWidth = await page
      .locator('article.card')
      .evaluate((element) => getComputedStyle(element).width)
    expect(hostWidth).toBe('20px')
  })

  test('projects HTML through public browser helpers into scene graph', async ({ page }) => {
    const css = `
      .card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 320px;
        height: 176px;
        padding: 24px;
      }
    `
    const card = await publicBrowserHTMLSceneGraph(
      page,
      '<article class="card"><h1>OpenPencil</h1></article>',
      css
    )

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(12)
    expect(card?.paddingLeft).toBe(24)
  })

  test('projects embedded HTML styles through public browser helpers', async ({ page }) => {
    const card = await publicBrowserHTMLSceneGraph(
      page,
      `<!doctype html>
      <html>
        <head>
          <style>
            .card { display: flex; flex-direction: column; gap: 14px; width: 300px; height: 160px; padding: 22px; }
          </style>
        </head>
        <body><article class="card"><h1>Embedded CSS</h1></article></body>
      </html>`
    )

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(300)
    expect(card?.height).toBe(160)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(14)
    expect(card?.paddingLeft).toBe(22)
  })

  test('projects JSX through public browser helpers into scene graph', async ({ page }) => {
    const css = await compileTailwindCSS(tailwindCardClasses)
    const card = await publicBrowserSceneGraph(page, [...tailwindCardClasses], css)

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(12)
    expect(card?.paddingLeft).toBe(24)
  })

  test('projects JSX and Tailwind through browser computed styles into scene graph', async ({
    page
  }) => {
    const classes = [...tailwindCardClasses]
    const document = await jsxToDesignDocument(
      jsx('article', {
        class: classes.join(' '),
        children: jsx('h1', { children: 'OpenPencil' })
      })
    )
    const css = await compileTailwindCSS(classes)
    const computedDocument = await browserRuntimeComputeStyles(page, document, css, 'iframe')
    const graph = designDocumentToSceneGraph(computedDocument)
    const designCard = computedDocument.children[0]
    const pageNode = graph.getPages()[0]
    const card = pageNode ? graph.getChildren(pageNode.id)[0] : undefined

    expect(designCard?.type).toBe('element')
    if (designCard?.type !== 'element') return
    expect(designCard.computedStyle?.display).toBe('flex')
    expect(designCard.computedStyle?.width).toBe('320px')
    expect(designCard.computedStyle?.height).toBe('176px')
    expect(designCard.computedStyle?.['padding-top']).toBe('24px')

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(176)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
  })
})
