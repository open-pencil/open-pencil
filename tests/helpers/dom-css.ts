import { expect } from 'bun:test'

import { colorToCSS } from '@open-pencil/core/color'
import type { DesignDocument } from '@open-pencil/dom-css'
import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * Asserts a node is a FRAME and returns it narrowed.
 * Shared across DOM/CSS conversion test files.
 */
export function expectFrame(node: SceneNode | undefined) {
  expect(node?.type).toBe('FRAME')
  if (node?.type !== 'FRAME') throw new Error('Expected frame node')
  return node
}

export const DOM_CSS_COLORS = {
  white: colorToCSS({ r: 1, g: 1, b: 1, a: 1 }),
  slate950: colorToCSS({ r: 2 / 255, g: 6 / 255, b: 23 / 255, a: 1 }),
  slate900: colorToCSS({ r: 17 / 255, g: 24 / 255, b: 39 / 255, a: 1 }),
  slate700: colorToCSS({ r: 31 / 255, g: 41 / 255, b: 55 / 255, a: 1 }),
  slate600: colorToCSS({ r: 71 / 255, g: 85 / 255, b: 105 / 255, a: 1 }),
  slate200: colorToCSS({ r: 226 / 255, g: 232 / 255, b: 240 / 255, a: 1 }),
  slate300: colorToCSS({ r: 203 / 255, g: 213 / 255, b: 225 / 255, a: 1 }),
  slate50: colorToCSS({ r: 248 / 255, g: 250 / 255, b: 252 / 255, a: 1 }),
  sky100: colorToCSS({ r: 224 / 255, g: 242 / 255, b: 254 / 255, a: 1 }),
  sky700: colorToCSS({ r: 3 / 255, g: 105 / 255, b: 161 / 255, a: 1 }),
  slateShadow: colorToCSS({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 0.12 }),
  dialogShadow: colorToCSS({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 0.16 })
} as const

export const simpleCardDocument: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'div',
      attrs: { class: 'card', 'data-id': 'node-1' },
      children: [{ type: 'text', text: 'OpenPencil' }]
    }
  ]
}

export const cssCardHTML = `
  <article class="card">
    <h1 class="title">OpenPencil</h1>
    <p class="description">Design with code-shaped CSS.</p>
  </article>
`

export const cssCardCSS = `
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    width: 320px;
    height: 180px;
    border: 1px solid ${DOM_CSS_COLORS.slate200};
    border-radius: 16px;
    background: white;
    box-shadow: 0px 8px 24px 0px ${DOM_CSS_COLORS.slateShadow};
    color: ${DOM_CSS_COLORS.slate900};
  }
  .card .title {
    font-size: 24px;
    font-weight: 700;
    line-height: 32px;
  }
  .description {
    font-size: 14px;
    line-height: 20px;
  }
`

export const computedCardDocument: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'div',
      attrs: { class: 'card' },
      computedStyle: {
        width: '320px',
        height: '160px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '12px',
        padding: '24px',
        'border-radius': '16px',
        'background-color': 'rgb(255, 255, 255)'
      },
      children: [
        {
          type: 'element',
          tagName: 'h1',
          attrs: {},
          computedStyle: {
            color: 'rgb(17, 24, 39)',
            'font-size': '24px',
            'font-weight': '700',
            'line-height': '32px'
          },
          children: [{ type: 'text', text: 'OpenPencil' }]
        }
      ]
    }
  ]
}

export const tailwindCardClasses = [
  'flex',
  'flex-col',
  'gap-3',
  'w-80',
  'h-44',
  'p-6',
  'rounded-xl',
  'bg-white',
  'text-slate-900'
] as const

export const tailwindButtonClasses = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-2',
  'rounded-md',
  'bg-slate-900',
  'px-4',
  'py-2',
  'text-sm',
  'font-medium',
  'text-white'
] as const

export const fixtureMatrixHTML = `
  <section class="fixture-shell">
    <nav class="navbar">
      <span class="brand">OpenPencil</span>
      <div class="nav-actions">
        <span class="nav-item">Docs</span>
        <span class="badge">Beta</span>
      </div>
    </nav>
    <dialog class="dialog" open>
      <h2 class="dialog-title">Import from web</h2>
      <p class="dialog-description">Convert HTML and CSS into editable design layers.</p>
      <input class="input" value="https://openpencil.dev" />
      <button class="primary-button">Create design</button>
    </dialog>
  </section>
`

export const fixtureMatrixCSS = `
  .fixture-shell {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 480px;
    padding: 32px;
    background: ${DOM_CSS_COLORS.slate50};
    color: ${DOM_CSS_COLORS.slate950};
  }
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 416px;
    height: 48px;
    padding: 0 16px;
    border: 1px solid ${DOM_CSS_COLORS.slate200};
    border-radius: 12px;
    background: ${DOM_CSS_COLORS.white};
  }
  .brand {
    font-size: 16px;
    font-weight: 700;
    line-height: 24px;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .nav-item {
    font-size: 14px;
    line-height: 20px;
    color: ${DOM_CSS_COLORS.slate700};
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 9999px;
    background: ${DOM_CSS_COLORS.sky100};
    color: ${DOM_CSS_COLORS.sky700};
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }
  .dialog {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 360px;
    min-width: 320px;
    max-width: 420px;
    padding: 24px;
    border: 1px solid ${DOM_CSS_COLORS.slate200};
    border-radius: 18px;
    background: ${DOM_CSS_COLORS.white};
    box-shadow: 0px 16px 40px 0px ${DOM_CSS_COLORS.dialogShadow};
  }
  .dialog-title {
    font-size: 20px;
    font-weight: 700;
    line-height: 28px;
  }
  .dialog-description {
    font-size: 14px;
    line-height: 20px;
    color: ${DOM_CSS_COLORS.slate600};
  }
  .input {
    width: 312px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid ${DOM_CSS_COLORS.slate300};
    border-radius: 8px;
    background: ${DOM_CSS_COLORS.white};
    color: ${DOM_CSS_COLORS.slate950};
    font-size: 14px;
    line-height: 20px;
  }
  .primary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 312px;
    height: 40px;
    border-radius: 8px;
    background: ${DOM_CSS_COLORS.slate950};
    color: ${DOM_CSS_COLORS.white};
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }
`

export const tailwindInputClasses = [
  'h-10',
  'w-80',
  'rounded-md',
  'border',
  'border-slate-300',
  'bg-white',
  'px-3',
  'text-sm',
  'text-slate-900'
] as const

export const tailwindBadgeClasses = [
  'inline-flex',
  'h-6',
  'items-center',
  'justify-center',
  'rounded-full',
  'bg-sky-100',
  'px-2.5',
  'text-xs',
  'font-semibold',
  'text-sky-700'
] as const

export const tailwindNavClasses = [
  'flex',
  'h-12',
  'w-96',
  'items-center',
  'justify-between',
  'rounded-xl',
  'border',
  'border-slate-200',
  'bg-white',
  'px-4'
] as const
