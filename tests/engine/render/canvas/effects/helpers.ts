import { mock } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderEffects } from '#core/canvas/shadows'

import {
  createMockCanvas,
  createMockRenderer,
  mockCalls as baseMockCalls,
  MockPath
} from '../helpers'

export { createMockCanvas, createMockRenderer, MockPath }

/** Extract call records from a bun:test mock function. */
export function mockCalls(fn: ReturnType<typeof mock>): unknown[][] {
  return baseMockCalls(fn)
}

/**
 * Create a renderer pre-wired for effects testing.
 * renderEffects delegates to the real implementation so
 * effects tests can exercise actual rendering logic.
 */
export function createEffectsRenderer(overrides: Partial<SkiaRenderer> = {}): SkiaRenderer {
  const defaults: Partial<SkiaRenderer> = {
    renderEffects: mock((...args: Parameters<typeof renderEffects>) =>
      renderEffects({ ...createMockRenderer(), ...overrides } as SkiaRenderer, ...args)
    )
  }
  return createMockRenderer({ ...defaults, ...overrides })
}
