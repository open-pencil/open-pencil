import { describe, it, expect } from 'bun:test'

import { DrawCallCounter } from '@open-pencil/core'

describe('DrawCallCounter', () => {
  it('handles null GL context', () => {
    const counter = new DrawCallCounter(null)
    expect(counter.count).toBe(0)
    expect(counter.reset()).toBe(0)
    counter.destroy()
  })

  it('wraps draw calls only while enabled', () => {
    let rawDrawCalls = 0
    const gl = {
      drawArrays: () => rawDrawCalls++,
      drawElements: () => rawDrawCalls++,
      drawArraysInstanced: () => rawDrawCalls++,
      drawElementsInstanced: () => rawDrawCalls++
    } as WebGL2RenderingContext
    const originalDrawArrays = gl.drawArrays

    const counter = new DrawCallCounter(gl)
    gl.drawArrays(0, 0, 0)
    expect(counter.count).toBe(0)
    expect(rawDrawCalls).toBe(1)

    counter.enable()
    expect(gl.drawArrays).not.toBe(originalDrawArrays)
    gl.drawArrays(0, 0, 0)
    expect(counter.count).toBe(1)
    expect(rawDrawCalls).toBe(2)

    counter.disable()
    expect(gl.drawArrays).toBe(originalDrawArrays)
    gl.drawArrays(0, 0, 0)
    expect(counter.count).toBe(1)
    expect(rawDrawCalls).toBe(3)
  })
})

