import { expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#fig-tests/helpers/fig-fixtures'
import { parseFigBuffer } from '#fig/archive'
import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'
import { LAZY_RECORD_FIELDS } from '#fig/document/read'

import { setIdSession, type SceneGraph } from '@open-pencil/scene-graph'

const FIXTURE = 'gold-preview.fig'

/** A session no Figma file's GUIDs use, so the IDs this test mints stand apart from theirs. */
const TEST_SESSION = 7_777

/**
 * A document's layers as JSON with every ID this test minted renamed by first appearance: IDs
 * come from one process-wide counter, so two documents built in turn differ only in them.
 */
function canonical(graph: SceneGraph): string {
  const json = JSON.stringify([...graph.nodes.values()], (_key, value: unknown) => {
    if (value instanceof Map) return [...value]
    if (value instanceof Set) return [...value]
    if (value instanceof Uint8Array) return [...value]
    return value
  })
  const order = new Map<string, number>()
  return json.replace(new RegExp(`"${TEST_SESSION}:\\d+"`, 'g'), (id) => {
    if (!order.has(id)) order.set(id, order.size)
    return `"#${order.get(id)}"`
  })
}

test('records read the same whether their bulky fields decode lazily or up front', () => {
  const bytes = readFixtureArrayBuffer(FIXTURE)
  const eager = parseFigBuffer(bytes.slice(0)).nodeChanges
  const lazy = parseFigBuffer(bytes.slice(0), undefined, {
    fields: { NodeChange: LAZY_RECORD_FIELDS }
  }).nodeChanges

  expect(structuredClone(lazy)).toEqual(eager)
})

// The archive reader leaves those fields encoded and resolves their bindings as they decode; the
// document it builds must match one built from records decoded whole.
test('an archive reader with lazy records builds the document records decoded whole build', () => {
  const bytes = readFixtureArrayBuffer(FIXTURE)
  const parsed = parseFigBuffer(bytes.slice(0))
  const options = { derivedBounds: true, onUnresolvedProperty: () => undefined }

  setIdSession(TEST_SESSION)
  try {
    const whole = materializeDocument(parsed.nodeChanges, parsed.blobs, {
      ...options,
      images: new Map(parsed.images)
    })
    const lazy = materializeFigArchive(bytes.slice(0), options)

    expect(canonical(lazy.graph)).toBe(canonical(whole.graph))
  } finally {
    setIdSession(0)
  }
})
