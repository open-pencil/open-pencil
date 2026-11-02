import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { hasInstanceOverride, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { pixelLength } from '@open-pencil/scene-graph/text'

beforeAll(async () => {
  await initCodec()
})

test('instance style overrides come back as overrides after saving and reopening', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const card = graph.createNode('COMPONENT', page, { name: 'Card', width: 200, height: 100 })
  graph.createNode('RECTANGLE', card.id, { name: 'Bar', width: 100, height: 10, strokeWeight: 1 })
  graph.createNode('TEXT', card.id, { name: 'Label', text: 'Hello world', fontSize: 12 })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const [bar, label] = graph.getChildren(instance.id)
  graph.updateNode(bar.id, { strokeWeight: 6, cornerSmoothing: 0.6 })
  recordInstanceOverride(graph, bar.id, ['strokeWeight', 'cornerSmoothing'])
  graph.updateNode(label.id, {
    letterSpacing: pixelLength(2),
    styleRuns: [{ start: 0, length: 5, style: { fontSize: 30 } }]
  })
  recordInstanceOverride(graph, label.id, ['letterSpacing', 'styleRuns'])

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const nodes = [...reopened.getAllNodes()]
  const copy = expectDefined(
    nodes.find((node) => node.type === 'INSTANCE'),
    'reopened instance'
  )
  const component = expectDefined(nodes.find((node) => node.type === 'COMPONENT'))
  const [reopenedBar, reopenedLabel] = reopened.getChildren(copy.id)
  expect(reopenedBar.strokeWeight).toBe(6)
  // Kiwi stores it as a 32-bit float, as Figma does.
  expect(reopenedBar.cornerSmoothing).toBeCloseTo(0.6)
  expect(reopenedLabel.letterSpacing).toEqual(pixelLength(2))
  expect(reopenedLabel.styleRuns).toEqual([
    expect.objectContaining({
      start: 0,
      length: 5,
      style: expect.objectContaining({ fontSize: 30 })
    })
  ])
  for (const [layer, field] of [
    [reopenedBar, 'strokeWeight'],
    [reopenedBar, 'cornerSmoothing'],
    [reopenedLabel, 'letterSpacing'],
    [reopenedLabel, 'styleRuns']
  ] as const)
    expect(hasInstanceOverride(reopened, layer.id, field)).toBe(true)

  // The reopened overrides hold through an edit to the component; the rest follows it.
  const [componentBar, componentLabel] = reopened.getChildren(component.id)
  reopened.updateNode(componentBar.id, { strokeWeight: 3, strokeAlign: 'OUTSIDE' })
  reopened.updateNode(componentLabel.id, { letterSpacing: pixelLength(5), textCase: 'UPPER' })
  reopened.syncInstances(component.id)
  expect([reopenedBar.strokeWeight, reopenedBar.strokeAlign]).toEqual([6, 'OUTSIDE'])
  expect([reopenedLabel.letterSpacing, reopenedLabel.textCase]).toEqual([pixelLength(2), 'UPPER'])
})

test('an instance that clears its component’s fill style keeps it cleared after reopening', async () => {
  // Figma desktop 126 claims the cleared style as the unset GUID, with the paints it keeps.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const red = {
    type: 'SOLID' as const,
    color: { r: 1, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true
  }
  const style = graph.createNode('RECTANGLE', page, {
    name: 'Red',
    sharedStyleType: 'FILL',
    fills: [red]
  })
  const card = graph.createNode('COMPONENT', page, { name: 'Card', width: 100, height: 100 })
  graph.createNode('RECTANGLE', card.id, { name: 'Box', fills: [red], fillStyleId: style.id })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const [box] = graph.getChildren(instance.id)
  graph.updateNode(box.id, { fillStyleId: null })
  recordInstanceOverride(graph, box.id, ['fillStyleId', 'fills'])

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const nodes = [...reopened.getAllNodes()]
  const copy = expectDefined(nodes.find((node) => node.type === 'INSTANCE'))
  const component = expectDefined(nodes.find((node) => node.type === 'COMPONENT'))
  const [reopenedBox] = reopened.getChildren(copy.id)
  const [componentBox] = reopened.getChildren(component.id)
  expect(componentBox.fillStyleId).toBeTruthy()
  expect(reopenedBox.fillStyleId).toBeFalsy()
  expect(hasInstanceOverride(reopened, reopenedBox.id, 'fillStyleId')).toBe(true)
  reopened.syncInstances(component.id)
  expect(reopenedBox.fillStyleId).toBeFalsy()
  expect(reopenedBox.fills).toEqual([
    expect.objectContaining({ color: expect.objectContaining({ r: 1 }) })
  ])
})
