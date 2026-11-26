import type { Page } from '@playwright/test'

import { imageDataURL } from '@open-pencil/scene-graph/images'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { Theme } from './app.ts'

export interface Callout {
  number: number
  side: 'left' | 'right'
  /** Where its line meets the control, from the picture's corner. */
  at: Vector
}

export interface Picture {
  png: Buffer
  width: number
  height: number
  radius: number
  callouts?: Callout[]
  /** Where to draw the pointer, which screenshots leave out. */
  pointer?: Vector
}

/** How far a callout's number stands from the picture. */
const REACH = 18
const LINE: Record<Theme, string> = { light: '#64748b', dark: '#94a3b8' }
const EDGE: Record<Theme, string> = { light: '#0f172a14', dark: '#ffffff14' }

function calloutMarkup({ number, side, at }: Callout, width: number): string {
  const left = side === 'left'
  const line = left
    ? `left:${-REACH}px;width:${at.x + REACH}px`
    : `left:${at.x}px;width:${width - at.x + REACH}px`
  const badge = left ? -REACH - 20 : width + REACH
  return `
    <i class="line" style="${line};top:${at.y}px"></i>
    <i class="end" style="left:${at.x - 2}px;top:${at.y - 2}px"></i>
    <b style="left:${badge}px;top:${at.y - 10}px">${number}</b>`
}

const pointerMarkup = ({ x, y }: Vector) => `
  <svg style="left:${x}px;top:${y}px" width="20" height="22" viewBox="0 0 20 22">
    <path d="M1 1v16l4.2-4 2.7 6.2 2.8-1.2-2.7-6H14z" fill="#111" stroke="#fff" stroke-width="1.4" />
  </svg>`

/** A picture as a raised card with its callouts, on a transparent background. */
export async function composePicture(
  sheet: Page,
  { png, width, height, radius, callouts = [], pointer }: Picture,
  theme: Theme
): Promise<Buffer> {
  await sheet.setContent(`
    <style>
      body { margin: 0; background: transparent }
      #sheet { display: inline-block; padding: 8px ${callouts.length > 0 ? 48 : 16}px 12px }
      #card { position: relative }
      img { display: block; border-radius: ${radius}px;
        box-shadow: 0 0 0 1px ${EDGE[theme]}, 0 1px 3px #0000001f, 0 4px 10px #0000001f }
      b, i, svg { position: absolute }
      b { width: 20px; height: 20px; border-radius: 10px; background: #2563eb; color: #fff;
        font: 600 11px/20px Inter, system-ui; text-align: center }
      .line { height: 1px; background: ${LINE[theme]} }
      .end { width: 5px; height: 5px; border-radius: 3px; background: #2563eb }
      svg { filter: drop-shadow(0 1px 2px #0006) }
    </style>
    <div id="sheet"><div id="card">
      <img width="${width}" height="${height}" src="${imageDataURL(png)}" />
      ${callouts.map((callout) => calloutMarkup(callout, width)).join('')}
      ${pointer ? pointerMarkup(pointer) : ''}
    </div></div>`)
  await sheet.waitForFunction(() => document.querySelector('img')?.complete)
  return sheet.locator('#sheet').screenshot({ omitBackground: true })
}

/** A point on screen, from the corner of the picture that shows `clip`. */
export const inside = (clip: Rect, { x, y }: Vector): Vector => ({ x: x - clip.x, y: y - clip.y })
