import { colorToCSS } from '@open-pencil/core/color'

import type { DesignDocument } from '../src/index'

export const TEST_COLORS = {
  white: colorToCSS({ r: 1, g: 1, b: 1, a: 1 }),
  slate950: colorToCSS({ r: 2 / 255, g: 6 / 255, b: 23 / 255, a: 1 }),
  slate900: colorToCSS({ r: 17 / 255, g: 24 / 255, b: 39 / 255, a: 1 }),
  slate700: colorToCSS({ r: 31 / 255, g: 41 / 255, b: 55 / 255, a: 1 }),
  slate200: colorToCSS({ r: 226 / 255, g: 232 / 255, b: 240 / 255, a: 1 }),
  slateShadow: colorToCSS({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 0.16 }),
  sky100: colorToCSS({ r: 224 / 255, g: 242 / 255, b: 254 / 255, a: 1 }),
  sky700: colorToCSS({ r: 3 / 255, g: 105 / 255, b: 161 / 255, a: 1 })
} as const

export const cardDocument: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'article',
      attrs: { class: 'card' },
      children: [
        {
          type: 'element',
          tagName: 'h1',
          attrs: { class: 'title' },
          children: [{ type: 'text', text: 'OpenPencil' }]
        }
      ]
    }
  ]
}

export const cardHTML = `
  <article class="card">
    <h1 class="title">OpenPencil</h1>
    <p class="description">Design with code-shaped CSS.</p>
  </article>
`

export const cardCSS = `
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 320px;
    height: 180px;
    padding: 24px;
    border: 1px solid ${TEST_COLORS.slate200};
    border-radius: 16px;
    background: ${TEST_COLORS.white};
    box-shadow: 0px 16px 40px 0px ${TEST_COLORS.slateShadow};
    color: ${TEST_COLORS.slate900};
  }
  .title {
    font-size: 24px;
    font-weight: 700;
    line-height: 32px;
  }
  .description {
    font-size: 14px;
    line-height: 20px;
    color: ${TEST_COLORS.slate700};
  }
`

export const fixtureHTML = `
  <section class="shell">
    <nav class="navbar">
      <span class="brand">OpenPencil</span>
      <span class="badge">Beta</span>
    </nav>
    <input class="input" value="https://openpencil.dev" />
  </section>
`

export const fixtureCSS = `
  .shell {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 480px;
    padding: 32px;
    background: ${TEST_COLORS.white};
  }
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 416px;
    height: 48px;
    padding: 0 16px;
    border: 1px solid ${TEST_COLORS.slate200};
    border-radius: 12px;
  }
  .brand {
    font-size: 16px;
    font-weight: 700;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 9999px;
    background: ${TEST_COLORS.sky100};
    color: ${TEST_COLORS.sky700};
    font-size: 12px;
    font-weight: 600;
  }
  .input {
    width: 312px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid ${TEST_COLORS.slate200};
    border-radius: 8px;
    color: ${TEST_COLORS.slate950};
    font-size: 14px;
  }
`

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
