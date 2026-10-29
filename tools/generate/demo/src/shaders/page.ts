/**
 * The page `drawShaderStills` opens in a browser: it draws a shader preset's first frame on a
 * WebGPU canvas and hands it back as a data URL, encoded as the editor encodes frames
 * (`shaderFrameEncoding`). Bundled for the browser at build time.
 */
import { createRendererFromJSON } from 'shaders/core'

import { shaderFrameEncoding, type ShaderPreset } from '@open-pencil/scene-graph/shaders'

export interface ShaderStillPage {
  renderStill(preset: ShaderPreset, width: number, height: number): Promise<string>
}

const page: ShaderStillPage = {
  async renderStill(preset, width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const renderer = createRendererFromJSON(structuredClone(preset))
    try {
      await renderer.initialize(canvas)
      // The first frame only prepares the effects' pipelines; the second is the still.
      await renderer.renderFrame({ deltaSeconds: 0, waitForGpu: false })
      await renderer.renderFrame({ deltaSeconds: 0, waitForGpu: false })
      // Without a usable GPU the renderer draws nothing and says so only here.
      const failure = renderer.getFailureReason()
      if (failure !== null) throw new Error(`WebGPU is unavailable (${failure})`)
      // A WebGPU canvas has no pixels to read; a 2D copy does.
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const context = copy.getContext('2d')
      if (!context) throw new Error('No 2D canvas to encode the frame')
      context.drawImage(canvas, 0, 0)
      const { type, quality } = shaderFrameEncoding(
        context.getImageData(0, 0, copy.width, copy.height).data
      )
      return copy.toDataURL(type, quality)
    } finally {
      renderer.dispose()
    }
  }
}

Object.assign(window, { shaderStill: page })
