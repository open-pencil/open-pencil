import { describe, expect, it } from 'bun:test'

import { laysOutBoxes } from '#dom-css/import/boxes'
import { createHeadlessCSSRuntime } from '#dom-css/index'

const TEXT_STYLE = 'color: rgb(0, 0, 0); font-family: system-ui; font-size: 16px; font-weight: 400'

function laysOut(html: string): boolean {
  return laysOutBoxes(createHeadlessCSSRuntime().parseHTML(html))
}

describe('laysOutBoxes', () => {
  // As Chromium puts a sentence copied from inside a paragraph on the clipboard.
  it('finds no boxes in text copied from inside one block', () => {
    expect(
      laysOut(
        `<span style="${TEXT_STYLE}; display: inline !important; float: none;">Open files and </span>` +
          `<a href="https://openpencil.dev/" style="${TEXT_STYLE}">an editor</a>`
      )
    ).toBe(false)
    expect(laysOut(`<p style="${TEXT_STYLE}; padding: 0px">Plain paragraph</p>`)).toBe(false)
  })

  // As Chromium puts a selection spanning a paragraph and a card on the clipboard.
  it('finds the boxes of a copy that spans a card', () => {
    expect(
      laysOut(
        `<p style="${TEXT_STYLE}">Intro</p>` +
          `<div style="display: flex; gap: 12px; padding: 16px; background: #eef; ${TEXT_STYLE}"><b>Title</b></div>`
      )
    ).toBe(true)
  })

  it('counts a changed display, a fill, a border, or a size as a box', () => {
    expect(laysOut('<a style="display: inline-block">Button</a>')).toBe(true)
    expect(laysOut('<span style="background-color: rgb(37, 99, 235)">Tag</span>')).toBe(true)
    expect(laysOut('<span style="border: 1px solid red">Tag</span>')).toBe(true)
    expect(laysOut('<div style="width: 300px">Fixed</div>')).toBe(true)
    expect(laysOut('<span style="background: rgb(238, 238, 255)">Tag</span>')).toBe(true)
  })

  it('finds no box in a border without a style or a width, or a clear background', () => {
    expect(laysOut('<span style="border: none">Text</span>')).toBe(false)
    expect(laysOut('<span style="border: 0px solid red">Text</span>')).toBe(false)
    expect(laysOut('<span style="background: transparent">Text</span>')).toBe(false)
  })

  it('finds no box in zero lengths of any unit, or in hidden elements', () => {
    expect(laysOut('<p style="padding: 0rem 0% 0.0px 0em">Text</p>')).toBe(false)
    expect(laysOut('<div style="display: none"><div style="width: 300px">Hidden</div></div>')).toBe(
      false
    )
  })
})
