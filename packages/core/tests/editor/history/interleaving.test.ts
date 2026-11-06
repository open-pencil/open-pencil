import { expect, test } from 'bun:test'

import fc from 'fast-check'

import { createEditor } from '@open-pencil/core'

/** Runs holders one at a time, as the app's document lock runs agents' edits. */
function createLock() {
  let tail: Promise<unknown> = Promise.resolve()
  return async (): Promise<() => void> => {
    const { promise, resolve } = Promise.withResolvers<undefined>()
    const previous = tail
    tail = previous.then(() => promise)
    await previous
    return () => resolve(undefined)
  }
}

/**
 * Agents edit one at a time and await between their writes, as tool calls await fonts and
 * layout; users edit whenever they like. However the scheduler orders them, every undo step must
 * move back only the layer its own writer moved. A failure prints its seed and the order the
 * scheduler chose, which `fc.assert(..., { seed, path })` replays.
 */
// Known gap: an agent's open edit takes in the users' writes made meanwhile.
test.failing('each undo step reverts only its own writer, in any interleaving', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.scheduler(),
      fc.integer({ min: 1, max: 3 }),
      fc.integer({ min: 1, max: 3 }),
      async (s, agents, users) => {
        const editor = createEditor()
        const pageId = editor.state.currentPageId
        const layers = new Map<string, string>()
        const layer = (label: string) => {
          const node = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
          layers.set(label, node.id)
          return node.id
        }
        const lock = createLock()

        const edits: Promise<unknown>[] = []
        for (let i = 0; i < agents; i++) {
          const label = `Agent ${i}`
          const id = layer(label)
          edits.push(
            (async () => {
              const release = await lock()
              try {
                await editor.recordEditAsync({ label }, async () => {
                  await s.schedule(Promise.resolve(), `${label} loads fonts`)
                  editor.graph.updateNode(id, { x: 1 })
                  await s.schedule(Promise.resolve(), `${label} lays out`)
                })
              } finally {
                release()
              }
            })()
          )
        }
        for (let i = 0; i < users; i++) {
          const label = `User ${i}`
          const id = layer(label)
          edits.push(
            s
              .schedule(Promise.resolve(), label)
              .then(() =>
                editor.recordEdit({ label }, () => editor.graph.updateNode(id, { x: 1 }))
              )
          )
        }
        await s.waitFor(Promise.all(edits))

        // After each undo, exactly the layers of the writers undone so far are back at 0.
        const positions = () =>
          Object.fromEntries([...layers].map(([owner, id]) => [owner, editor.graph.getNode(id)?.x]))
        const expected = (undone: string[]) =>
          Object.fromEntries([...layers.keys()].map((owner) => [owner, undone.includes(owner) ? 0 : 1]))
        const undone: string[] = []
        expect(positions()).toEqual(expected(undone))
        for (let label = editor.undo.undo(); label; label = editor.undo.undo()) {
          undone.push(label)
          expect(positions()).toEqual(expected(undone))
        }
        expect(undone.toSorted()).toEqual([...layers.keys()].toSorted())
      }
    )
  )
})
