import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, diffDocuments } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '#core-tests/helpers/assert'

type DiffResult = { diff?: string | null; error?: string }
type ApplyResult = {
  error?: string
  applied?: number
  failed?: number
  results?: { status: string; id: string | null; error?: string; changes?: string[] }[]
}

function tool(name: string) {
  return expectDefined(
    ALL_TOOLS.find((candidate) => candidate.name === name),
    name
  )
}

async function run<Result>(figma: FigmaAPI, name: string, args: Record<string, unknown>) {
  return (await tool(name).execute(figma, args)) as Result
}

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const card = figma.createFrame()
  card.name = 'Card'
  card.resize(200, 100)
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  const label = figma.createRectangle()
  label.name = 'Label'
  label.resize(80, 20)
  card.appendChild(label)
  const badge = figma.createEllipse()
  badge.name = 'Badge'
  card.appendChild(badge)
  return { graph, figma, card, label, badge }
}

async function createPatch(figma: FigmaAPI, from: string, to: string): Promise<string> {
  return expectDefined((await run<DiffResult>(figma, 'diff_create', { from, to })).diff, 'patch')
}

describe('diff_create and diff_apply', () => {
  test('a patch from a modified copy makes the original match it', async () => {
    const { graph, figma, card, label, badge } = setup()
    const copy = card.clone()
    copy.name = 'Card copy'
    copy.opacity = 0.5
    copy.cornerRadius = 12
    expectDefined(copy.children[0], 'copied label').resize(120, 24)
    // Move the badge first and add a note at the end.
    copy.insertChild(0, expectDefined(copy.children[1], 'copied badge'))
    const note = figma.createText()
    note.name = 'Note'
    note.characters = 'Sale'
    copy.appendChild(note)

    const patch = await createPatch(figma, card.id, copy.id)
    expect(patch).toContain(`@@ /Card #${card.id}\n+rounded={12}\n+opacity={0.5}`)
    expect(patch).toContain(`@@ /Card/Label #${label.id}\n-w={80}\n-h={20}\n+w={120}\n+h={24}`)
    expect(patch).toContain(`@@ /Card/Badge #${badge.id} moved to 0`)
    expect(patch).toContain(`@@ /Card/Note added to #${card.id} at 2\n+<Text name="Note"`)

    const applied = await run<ApplyResult>(figma, 'diff_apply', { patch })
    expect(applied).toMatchObject({ applied: 4, failed: 0 })
    // Updates and moves keep their nodes; only the added note is new.
    expect(getNodeOrThrow(graph, card.id).childIds.slice(0, 2)).toEqual([badge.id, label.id])
    expect(getNodeOrThrow(graph, label.id).width).toBe(120)
    expect(await run<DiffResult>(figma, 'diff_create', { from: card.id, to: copy.id })).toEqual({
      diff: null,
      message: 'No differences found'
    })
  })

  test('changes only the fields an attribute moves', async () => {
    const { graph, figma, card } = setup()
    card.setPluginData('note', 'kept')
    const copy = card.clone()
    copy.opacity = 0.5

    await run<ApplyResult>(figma, 'diff_apply', { patch: await createPatch(figma, card.id, copy.id) })
    expect(getNodeOrThrow(graph, card.id).opacity).toBe(0.5)
    expect(card.getPluginData('note')).toBe('kept')
  })

  test('rejects a stale patch without changing any node', async () => {
    const { graph, figma, card, label } = setup()
    const copy = card.clone()
    copy.opacity = 0.5
    expectDefined(copy.children[0], 'copied label').resize(120, 24)
    const patch = await createPatch(figma, card.id, copy.id)
    label.resize(90, 20)

    const applied = await run<ApplyResult>(figma, 'diff_apply', { patch })
    expect(applied.error).toBe('Patch does not apply')
    expect(applied.results?.[0]?.error).toContain('w: expected w={80}, found w={90}')
    // The card still matched, but a stale patch must not half-apply.
    expect(getNodeOrThrow(graph, card.id).opacity).toBe(1)
  })

  test.each([false, true])(
    'rejects a patch with an invalid value without changing any node (force: %p)',
    async (force) => {
      const { graph, figma, card, label } = setup()
      const copy = card.clone()
      copy.opacity = 0.5
      expectDefined(copy.children[0], 'copied label').resize(120, 24)
      const patch = (await createPatch(figma, card.id, copy.id)).replace('+w={120}', '+w={wide}')

      const applied = await run<ApplyResult>(figma, 'diff_apply', { patch, force })
      expect(applied.error).toBe('Patch does not apply')
      // The card's change was valid, but it must not land without the label's.
      expect(getNodeOrThrow(graph, card.id).opacity).toBe(1)
      expect(getNodeOrThrow(graph, label.id).width).toBe(80)
    }
  )

  test('rejects a patch that adds an attribute the node has since gained', async () => {
    const { figma, label } = setup()
    const shown = await run<DiffResult>(figma, 'diff_show', {
      id: label.id,
      attributes: 'opacity={0.5}'
    })
    label.opacity = 0.8

    const applied = await run<ApplyResult>(figma, 'diff_apply', {
      patch: expectDefined(shown.diff, 'patch')
    })
    expect(applied.results?.[0]?.error).toContain('opacity: expected none, found opacity={0.8}')
  })

  test('dry run reports changes without applying them', async () => {
    const { graph, figma, card } = setup()
    const copy = card.clone()
    copy.opacity = 0.25

    const applied = await run<ApplyResult>(figma, 'diff_apply', {
      patch: await createPatch(figma, card.id, copy.id),
      dryRun: true
    })
    expect(applied.results?.[0]?.changes).toEqual(['opacity'])
    expect(getNodeOrThrow(graph, card.id).opacity).toBe(1)
  })

  test('removes children the target no longer has', async () => {
    const { graph, figma, card, label } = setup()
    const copy = card.clone()
    expectDefined(copy.children[0], 'copied label').remove()

    const applied = await run<ApplyResult>(figma, 'diff_apply', {
      patch: await createPatch(figma, card.id, copy.id)
    })
    expect(applied.results?.map((result) => result.status)).toEqual(['removed'])
    expect(graph.getNode(label.id)).toBeUndefined()
  })

  test('rejects an attribute the renderer would ignore', async () => {
    const { graph, figma, card } = setup()
    const patch = `@@ /Card #${card.id}\n+opacity={0.5}\n+bogus={1}`

    const applied = await run<ApplyResult>(figma, 'diff_apply', { patch })
    expect(applied.error).toBe('Patch does not apply')
    expect(applied.results?.[0]?.error).toBe('Unsupported attribute "bogus"')
    expect(getNodeOrThrow(graph, card.id).opacity).toBe(1)
  })

  test('leaves the document as it was when an added node fails to render', async () => {
    const { graph, figma, card } = setup()
    const children = [...getNodeOrThrow(graph, card.id).childIds]
    // The JSX evaluates, so the check passes, but rendering finds no such component.
    const patch = [
      `@@ /Card #${card.id}`,
      '+opacity={0.5}',
      `@@ /Card/Dot added to #${card.id} at 0`,
      '+<Ellipse name="Dot" />',
      `@@ /Card/Button added to #${card.id} at 1`,
      '+<Instance component="Missing" />'
    ].join('\n')

    const applied = await run<ApplyResult>(figma, 'diff_apply', { patch })
    expect(applied.error).toBe('Patch does not apply')
    expect(applied.results?.[0]?.error).toContain('component not found: Missing')
    expect(getNodeOrThrow(graph, card.id).opacity).toBe(1)
    expect(getNodeOrThrow(graph, card.id).childIds).toEqual(children)
  })

  test('reports a hunk it cannot read', async () => {
    const { figma } = setup()
    const applied = await run<ApplyResult>(figma, 'diff_apply', { patch: 'w={1}' })
    expect(applied.error).toBe('Line 1: unexpected line: w={1}')
  })
})

describe('diff_show', () => {
  test('previews attributes without changing the node, as a patch diff_apply applies', async () => {
    const { graph, figma, card } = setup()

    const shown = await run<DiffResult>(figma, 'diff_show', {
      id: card.id,
      attributes: 'bg="#FF0000" w={240} opacity={0.5}'
    })
    const patch = expectDefined(shown.diff, 'patch')
    expect(patch).toBe(
      `@@ /Card #${card.id}\n-bg="#FFFFFF"\n-w={200}\n+bg="#FF0000"\n+w={240}\n+opacity={0.5}`
    )
    expect(getNodeOrThrow(graph, card.id).width).toBe(200)

    await run<ApplyResult>(figma, 'diff_apply', { patch })
    const node = getNodeOrThrow(graph, card.id)
    expect(node.width).toBe(240)
    expect(node.opacity).toBe(0.5)
    expect(node.fills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test.each([
    ['w={', 'Invalid JSX attributes'],
    ['opacity={half}', 'half is not defined']
  ])('rejects %p', async (attributes, error) => {
    const { figma, card } = setup()
    const shown = await run<DiffResult>(figma, 'diff_show', { id: card.id, attributes })
    expect(shown.error).toContain(error)
  })
})

describe('diffDocuments', () => {
  test('matches pages by name and nodes by path across documents', () => {
    const before = setup()
    const after = setup()
    after.label.resize(80, 40)
    const extra = after.figma.createEllipse()
    extra.name = 'Dot'

    const result = diffDocuments(before.graph, after.graph)
    expect(result.pages.map((page) => page.status)).toEqual(['changed'])
    const diff = expectDefined(result.diff, 'document diff')
    expect(diff).toContain(`@@ /Page 1/Card/Label #${before.label.id}\n-h={20}\n+h={40}`)
    expect(diff).toContain('@@ /Page 1/Dot added to')
  })

  test('reports identical documents as unchanged', () => {
    const result = diffDocuments(setup().graph, setup().graph)
    expect(result.diff).toBeNull()
    expect(result.changed).toBe(false)
    expect(result.pages.map((page) => page.status)).toEqual(['unchanged'])
  })

  test('reports a page only one document has by status, without a patch', () => {
    const before = setup()
    const after = setup()
    after.graph.addPage('Empty')
    const extra = after.graph.addPage('Extra')
    after.graph.createNode('FRAME', extra.id, { name: 'Card' })

    const result = diffDocuments(before.graph, after.graph)
    expect(result.changed).toBe(true)
    expect(result.diff).toBeNull()
    expect(result.pages.map(({ name, status, diff }) => ({ name, status, diff }))).toEqual([
      { name: 'Page 1', status: 'unchanged', diff: null },
      { name: 'Empty', status: 'added', diff: null },
      { name: 'Extra', status: 'added', diff: null }
    ])
  })
})
