import { describe, expect, it } from 'bun:test'

import type { JSXPreviewNode } from '@open-pencil/core/design-jsx'

import { createJSXPreviewController, type PreviewArtifact } from '@/app/ai/preview/controller'
import { readPreviewInput, type RenderPreviewInput } from '@/app/ai/preview/input'

function artifact() {
  return {
    shown: 0,
    disposed: 0,
    show() {
      this.shown++
    },
    dispose() {
      this.disposed++
    }
  }
}

function fixture(
  build?: (
    tree: JSXPreviewNode,
    input: RenderPreviewInput,
    signal: AbortSignal
  ) => Promise<PreviewArtifact | null>
) {
  let current = 1
  const artifacts: ReturnType<typeof artifact>[] = []
  const trees: JSXPreviewNode[] = []
  const controller = createJSXPreviewController({
    capture: () => current,
    isCurrent: (target) => target === current,
    async build(_target, tree, input, signal) {
      trees.push(tree)
      if (build) return build(tree, input, signal)
      const resource = artifact()
      artifacts.push(resource)
      return resource
    }
  })
  return {
    controller,
    artifacts,
    trees,
    changeTarget: () => {
      current++
    }
  }
}

const opening = '{"x":100,"y":80,"jsx":"<Frame w={400} h={200}>'

describe('JSX tool preview controller', () => {
  it('decodes incomplete JSON without inventing a partial number', () => {
    expect(readPreviewInput(opening)?.jsx).toBe('<Frame w={400} h={200}>')
    expect(readPreviewInput('{"jsx":"<Frame/>","x":1e')).toEqual({ jsx: '<Frame/>' })
    expect(readPreviewInput('{"jsx":12}')).toBeNull()
  })

  it('coalesces deltas and publishes immutable progressive snapshots', async () => {
    const { controller, artifacts, trees } = fixture()
    try {
      controller.start('call')
      controller.delta('call', opening)
      controller.delta('call', '<Text>Hello')
      await controller.flush('call')
      expect(artifacts).toHaveLength(1)
      expect(artifacts[0]?.shown).toBe(1)
      expect(trees[0]?.children).toMatchObject([{ type: 'text', children: ['Hello'] }])
      controller.delta('call', ' world</Text>')
      await controller.flush('call')
      expect(artifacts[0]?.disposed).toBe(1)
      expect(artifacts[1]?.shown).toBe(1)
      expect(trees[0]?.children).toMatchObject([{ type: 'text', children: ['Hello'] }])
      controller.finish('call')
      expect(artifacts[1]?.disposed).toBe(1)
    } finally {
      controller.clear()
    }
  })

  it('holds the last valid picture while an attribute is incomplete', async () => {
    const { controller, artifacts } = fixture()
    try {
      controller.start('call')
      controller.delta('call', opening)
      await controller.flush('call')
      controller.delta('call', '<Rect w={')
      await controller.flush('call')
      expect(artifacts.at(-1)?.shown).toBe(1)
    } finally {
      controller.clear()
    }
  })

  it('cleans up on abort and ignores further deltas', async () => {
    const { controller, artifacts } = fixture()
    const abort = new AbortController()
    try {
      controller.start('call', abort.signal)
      controller.delta('call', opening)
      await controller.flush('call')
      abort.abort()
      expect(artifacts[0]?.disposed).toBe(1)
      controller.delta('call', '<Rect/>')
      await controller.flush('call')
      expect(artifacts).toHaveLength(1)
    } finally {
      controller.clear()
    }
  })

  it('disposes a late async result after final execution starts', async () => {
    const pending = Promise.withResolvers<PreviewArtifact>()
    const resource = artifact()
    const { controller } = fixture(async () => pending.promise)
    try {
      controller.start('call')
      controller.delta('call', opening)
      const rendering = controller.flush('call')
      controller.finish('call')
      pending.resolve(resource)
      await rendering
      expect(resource.shown).toBe(0)
      expect(resource.disposed).toBe(1)
    } finally {
      controller.clear()
    }
  })

  it('does not publish stale revisions or render concurrently for one call', async () => {
    const pending = Promise.withResolvers<PreviewArtifact>()
    const resource = artifact()
    const { controller, trees } = fixture(async () => pending.promise)
    try {
      controller.start('call')
      controller.delta('call', opening)
      const rendering = controller.flush('call')
      controller.delta('call', '<Rect/>')
      await controller.flush('call')
      expect(trees).toHaveLength(1)
      pending.resolve(resource)
      await rendering
      expect(resource.shown).toBe(0)
      expect(resource.disposed).toBe(1)
    } finally {
      controller.clear()
    }
  })

  it('discards async work after changing the target editor/page', async () => {
    const pending = Promise.withResolvers<PreviewArtifact>()
    const resource = artifact()
    const { controller, changeTarget } = fixture(async () => pending.promise)
    try {
      controller.start('call')
      controller.delta('call', opening)
      const rendering = controller.flush('call')
      changeTarget()
      pending.resolve(resource)
      await rendering
      expect(resource.shown).toBe(0)
      expect(resource.disposed).toBe(1)
    } finally {
      controller.clear()
    }
  })

  it('isolates concurrent calls and removes only the completed preview', async () => {
    const { controller, artifacts } = fixture()
    try {
      for (const id of ['one', 'two']) {
        controller.start(id)
        controller.delta(id, opening)
        await controller.flush(id)
      }
      controller.finish('one')
      expect(artifacts[0]?.disposed).toBe(1)
      expect(artifacts[1]?.disposed).toBe(0)
    } finally {
      controller.clear()
    }
    expect(artifacts[1]?.disposed).toBe(1)
  })

  it('bounds input and treats rendering errors as preview-only failures', async () => {
    const { controller, trees } = fixture(async () => {
      throw new Error('preview unavailable')
    })
    try {
      controller.start('oversized')
      controller.delta('oversized', 'x'.repeat(256_001))
      await controller.flush('oversized')
      expect(trees).toHaveLength(0)
      controller.start('call')
      controller.delta('call', opening)
      await expect(controller.flush('call')).resolves.toBeUndefined()
      controller.delta('call', '<Rect/>')
      await controller.flush('call')
      expect(trees).toHaveLength(1)
    } finally {
      controller.clear()
    }
  })
})
