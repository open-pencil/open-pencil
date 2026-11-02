import { expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

async function render(jsx: string) {
  const graph = new SceneGraph()
  const [root] = await renderJSX(graph, jsx)
  if (!root) throw new Error('Nothing rendered')
  return { graph, root: getNodeOrThrow(graph, root.id) }
}

test('JavaScript inside braces builds repeated and conditional content', async () => {
  const { graph, root } = await render(
    `<Frame flex="row" wrap w={300}>{Array.from({ length: 35 }, (_, i) => (
      <Frame w={36} h={36} name={i % 7 === 0 ? 'Sunday' : 'Day'} />
    ))}</Frame>`
  )
  expect(root.childIds).toHaveLength(35)
  expect(graph.getNode(root.childIds[7] ?? '')?.name).toBe('Sunday')
})

test('an arrow function called in place can hold statements', async () => {
  const { graph, root } = await render(
    `<Frame>{(() => {
      const days = ['Mo', 'Tu', 'We']
      return days.map((day) => <Text name={day}>{day}</Text>)
    })()}</Frame>`
  )
  expect(root.childIds.map((id) => graph.getNode(id)?.name)).toEqual(['Mo', 'Tu', 'We'])
})

test('statements run before the JSX they return, with or without semicolons', async () => {
  const { graph, root } = await render(`const days = ['Mo', 'Tu']
const label = (day: string) => day.toUpperCase()
return <Frame name="Week">{days.map((day) => <Text name={label(day)}>{day}</Text>)}</Frame>`)
  expect(root.name).toBe('Week')
  expect(root.childIds.map((id) => graph.getNode(id)?.name)).toEqual(['MO', 'TU'])
})

test('the returned JSX may open with a parenthesis on the line of the return', async () => {
  const { root } = await render(`const name = 'Wrapped'
return (
  <Frame name={name} />
)`)
  expect(root.name).toBe('Wrapped')
})

test('statements may return sibling elements in a fragment, which all render', async () => {
  const graph = new SceneGraph()
  const results = await renderJSX(
    graph,
    `const size = 40
return <>
  <Frame name="A" w={size} />
  <Frame name="B" w={size} />
</>`
  )
  expect(results.map(({ name }) => name)).toEqual(['A', 'B'])
  expect(results.map(({ id }) => graph.getNode(id)?.width)).toEqual([40, 40])
})

test('sibling elements on their own lines stay siblings', async () => {
  const graph = new SceneGraph()
  const results = await renderJSX(graph, '<Frame name="A" />\n<Frame name="B" />')
  expect(results.map(({ name }) => name)).toEqual(['A', 'B'])
})

test('a statement may shadow a helper or element name', async () => {
  const { root } = await render(`const solid = 'Shadowed'
return <Frame name={solid} />`)
  expect(root.name).toBe('Shadowed')
})

test('statements that do not return the JSX are reported as such', async () => {
  const graph = new SceneGraph()
  const rule = 'Design JSX is one JSX expression, or statements that end with `return` and the JSX'
  await expect(renderJSX(graph, `const size = 40\n<Frame w={size} />`)).rejects.toThrow(rule)
  await expect(renderJSX(graph, `const name = 'Wrapped'\n(<Frame name={name} />)`)).rejects.toThrow(
    `${rule}; these statements return nothing.`
  )
})

test('a comment before the JSX does not end the return', async () => {
  const { root } = await render('// The header\n<Frame name="Header" />')
  expect(root.name).toBe('Header')
})
