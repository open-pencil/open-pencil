import { describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  analyzeAttachedImages,
  designMessageWithImageFindings,
  type ImageAnalysisDependencies
} from '@/app/ai/attachment/image/analyze'
import {
  prepareImageAttachment,
  validateImageAttachmentFile
} from '@/app/ai/attachment/image/prepare'
import type { PreparedImageAttachment } from '@/app/ai/attachment/image/types'
import type { EditorStore } from '@/app/editor/session/create'

const image: PreparedImageAttachment = {
  data: new Uint8Array([4, 5, 6]),
  blob: new Blob(),
  mediaType: 'image/png',
  originalWidth: 1600,
  originalHeight: 900,
  width: 1280,
  height: 720
}

const secondImage: PreparedImageAttachment = {
  ...image,
  data: new Uint8Array([7, 8, 9])
}

describe('image attachment analysis', () => {
  test('rejects unsupported and oversized source files', () => {
    expect(validateImageAttachmentFile(new File(['x'], 'image.gif', { type: 'image/gif' }))).toBe(
      'Choose a PNG, JPEG, or WebP image.'
    )
    expect(
      validateImageAttachmentFile(
        new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'image.png', {
          type: 'image/png'
        })
      )
    ).toBe('Images must be 20 MB or smaller.')
  })

  test('fails with a controlled error without browser image APIs', async () => {
    await expect(
      prepareImageAttachment(new File(['png'], 'image.png', { type: 'image/png' }))
    ).rejects.toThrow('Image attachments are unavailable in this environment.')
  })

  test('sends all bounded images only to Vision and returns text findings', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { width: 2560, height: 1600 })
    const requests: unknown[] = []
    const store = {
      graph,
      state: { currentPageId: page.id, selectedIds: new Set([frame.id]) },
      renderExportImage: async () => new Uint8Array([1, 2, 3])
    } as EditorStore
    const dependencies: ImageAnalysisDependencies = {
      createRuntime: async () =>
        ({
          kind: 'direct',
          model: {} as LanguageModel,
          role: {
            requestedRole: 'vision',
            profile: { maxOutputTokens: 8000, reasoningEffort: 'low' },
            connection: { providerID: 'openrouter' }
          }
        }) as never,
      inspect: async (options) => {
        requests.push(options)
        return { text: 'Use a tighter grid and stronger heading contrast.' } as never
      }
    }

    const findings = await analyzeAttachedImages(
      store,
      'Match this layout',
      [image, secondImage],
      dependencies
    )

    expect(findings).toBe('Use a tighter grid and stronger heading contrast.')
    const request = requests[0] as {
      providerOptions?: unknown
      messages: Array<{ content: Array<{ type: string; data?: Uint8Array }> }>
    }
    expect(request.providerOptions).toEqual({ openrouter: { reasoning: { effort: 'low' } } })
    expect(request.messages[0]?.content.map((part) => part.type)).toEqual([
      'text',
      'file',
      'file',
      'file'
    ])
    expect(request.messages[0]?.content[1]?.data).toEqual(image.data)
    expect(request.messages[0]?.content[2]?.data).toEqual(secondImage.data)
  })

  test('passes textual findings rather than image data to Design', () => {
    const message = designMessageWithImageFindings(
      'Match this layout',
      ['first.png', 'second.png'],
      'Use a 12-column grid.'
    )

    expect(message).toContain('Match this layout')
    expect(message).toContain('first.png')
    expect(message).toContain('second.png')
    expect(message).toContain('Use a 12-column grid.')
    expect(message).not.toContain('base64')
  })
})
