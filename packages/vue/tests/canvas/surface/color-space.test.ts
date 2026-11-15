import { expect, test } from 'bun:test'

import {
  configurePresentation,
  isHardwareRenderer,
  type PresentationColorSpace
} from '#vue/canvas/surface/color-space'

const RGBA8 = 32856
const RGBA16F = 34842

interface FakeContextOptions {
  colorSpace?: PresentationColorSpace
  format?: number
  size?: [number, number]
  /** Model renderers that accept the call but keep the previous pixel format. */
  acceptFloatStorage?: boolean
  ignoreColorSpaceSetter?: boolean
  extensions?: string[]
}

function fakeContext(options: FakeContextOptions = {}) {
  const extensions = new Set(options.extensions ?? ['EXT_color_buffer_float', 'EXT_float_blend'])
  const size = options.size ?? [800, 600]
  const context = {
    drawingBufferColorSpace: (options.colorSpace ?? 'srgb') as PresentationColorSpace,
    drawingBufferFormat: options.format ?? RGBA8,
    RGBA8,
    RGBA16F,
    drawingBufferWidth: size[0],
    drawingBufferHeight: size[1],
    storageCalls: [] as { format: number; width: number; height: number }[],
    getExtension(name: string) {
      return extensions.has(name) ? { loseContext: () => undefined } : null
    },
    drawingBufferStorage(format: number, width: number, height: number) {
      context.storageCalls.push({ format, width, height })
      const accepted = format !== RGBA16F || options.acceptFloatStorage !== false
      if (accepted) {
        context.drawingBufferFormat = format
        context.drawingBufferWidth = width
        context.drawingBufferHeight = height
      }
    }
  }
  if (options.ignoreColorSpaceSetter) {
    // Model a browser that keeps its P3 buffer when asked for sRGB.
    Object.defineProperty(context, 'drawingBufferColorSpace', {
      get: () => 'display-p3' as PresentationColorSpace,
      set: () => {
        /* ignored */
      }
    })
  }
  return context
}

function requestFor(documentColorSpace: 'srgb' | 'display-p3', wideGamutDisplay = true) {
  return { documentColorSpace, wideGamutDisplay, width: 800, height: 600 }
}

test('an sRGB document presents in sRGB without touching storage', () => {
  const context = fakeContext()
  expect(configurePresentation(context, requestFor('srgb'))).toBe('srgb')
  expect(context.storageCalls).toEqual([])
})

test('a P3 document on a wide-gamut display uses a float buffer and P3 presentation', () => {
  const context = fakeContext({ format: RGBA8 })
  expect(configurePresentation(context, requestFor('display-p3'))).toBe('display-p3')
  expect(context.storageCalls).toEqual([{ format: RGBA16F, width: 800, height: 600 }])
  expect(context.drawingBufferFormat).toBe(RGBA16F)
})

test('a P3 document stays sRGB when the display is not wide gamut', () => {
  const context = fakeContext()
  expect(configurePresentation(context, requestFor('display-p3', false))).toBe('srgb')
  expect(context.storageCalls).toEqual([])
})

test('browsers without drawingBufferStorage keep their default sRGB buffer', () => {
  const context = fakeContext({ format: RGBA8 })
  // WebKit exposes drawingBufferColorSpace but no storage API at all.
  Object.assign(context, { drawingBufferStorage: undefined })
  expect(configurePresentation(context, requestFor('display-p3'))).toBe('srgb')
})

test('a renderer that rejects the float format stays on the sRGB buffer', () => {
  // Renderers that accept the call but draw incorrectly cannot be detected here; those
  // are excluded by isHardwareRenderer, which this suite covers separately.
  const context = fakeContext({ acceptFloatStorage: false })
  expect(configurePresentation(context, requestFor('display-p3'))).toBe('srgb')
  expect(context.storageCalls).toEqual([{ format: RGBA16F, width: 800, height: 600 }])
  expect(context.drawingBufferFormat).toBe(RGBA8)
})

test('an unchanged size and format does not reallocate the drawing buffer', () => {
  const context = fakeContext({ format: RGBA16F })
  expect(configurePresentation(context, requestFor('display-p3'))).toBe('display-p3')
  expect(context.storageCalls).toEqual([])
})

test('a renderer without the float extensions stays on the sRGB path', () => {
  const context = fakeContext({ extensions: [] })
  expect(configurePresentation(context, requestFor('display-p3'))).toBe('srgb')
  expect(context.storageCalls).toEqual([])
})

test('a browser that ignores the color-space request cannot be presented consistently', () => {
  const context = fakeContext({ ignoreColorSpaceSetter: true })
  expect(configurePresentation(context, requestFor('srgb'))).toBe(null)
})

test('browsers without color-space control use their default sRGB buffer', () => {
  expect(configurePresentation(null, requestFor('display-p3'))).toBe('srgb')
  expect(configurePresentation({}, requestFor('display-p3'))).toBe('srgb')
})

test('software rasterizers are not treated as hardware renderers', () => {
  expect(
    isHardwareRenderer(
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)'
    )
  ).toBe(false)
  expect(isHardwareRenderer('Mesa/X.org, llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(false)
  expect(isHardwareRenderer('Microsoft Basic Render Driver')).toBe(false)
  expect(
    isHardwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)')
  ).toBe(true)
  expect(isHardwareRenderer('Adreno (TM) 740')).toBe(true)
  // An unknown renderer must not be assumed to be hardware.
  expect(isHardwareRenderer(null)).toBe(false)
  expect(isHardwareRenderer('')).toBe(false)
})
