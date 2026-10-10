import { describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { readComments, SceneGraph } from '@open-pencil/scene-graph'

/** A document with a Card frame holding a Title, as a script would build it. */
async function document() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  await compileScript(`
    const card = figma.createFrame()
    card.name = 'Card'
    card.x = 100
    card.y = 50
    card.resize(200, 120)
    const title = figma.createText()
    title.name = 'Title'
    card.appendChild(title)
  `)(figma)
  const named = (name: string) => {
    const node = [...graph.getAllNodes()].find((entry) => entry.name === name)
    if (!node) throw new Error(`No ${name}`)
    return node
  }
  return { graph, figma, card: named('Card'), title: named('Title') }
}

describe('openpencil comments', () => {
  test('a script comments on a layer, which pins it to the top-level frame', async () => {
    const { graph, figma, card, title } = await document()
    const comment = await compileScript(`
      return openpencil.addComment('Make the **title** bigger', {
        node: ${JSON.stringify(title.id)},
        x: 4,
        author: 'Reviewer'
      }).toJSON()
    `)(figma)

    expect(comment).toMatchObject({
      text: 'Make the **title** bigger',
      author: 'Reviewer',
      resolved: false,
      node: { id: card.id, name: 'Card' },
      replies: []
    })
    expect(readComments(graph)).toHaveLength(1)
  })

  test('an agent finds open feedback, answers it and resolves it', async () => {
    const { figma, title } = await document()
    await compileScript(`
      openpencil.addComment('Too small', { node: ${JSON.stringify(title.id)}, author: 'Dana' })
      openpencil.addComment('Already fixed', { x: 10, y: 10, author: 'Dana' }).resolve()
    `)(figma)

    const result = await compileScript(`
      const open = openpencil.getComments({ resolved: false })
      for (const comment of open) comment.reply('Bumped it to 24px', { author: 'Claude' }).resolve()
      return {
        open: open.length,
        stillOpen: openpencil.getComments({ resolved: false }).length,
        claude: openpencil.getComments({ author: 'Claude' }).map((comment) => comment.replies)
      }
    `)(figma)

    expect(result).toEqual({
      open: 1,
      stillOpen: 0,
      claude: [[expect.objectContaining({ author: 'Claude', text: 'Bumped it to 24px' })]]
    })
  })

  test('comments survive saving the .fig file and opening it again', async () => {
    await initCodec()
    const { graph, figma } = await document()
    await compileScript(`
      const comment = openpencil.addComment('Check spacing', { x: 5, y: 6 })
      comment.reply('Done').resolve()
      openpencil.addComment('Gone').remove()
    `)(figma)

    const reopened = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    expect(readComments(reopened)).toEqual(readComments(graph))
    expect(readComments(reopened).filter((thread) => !thread.deleted)).toHaveLength(1)
  })

  test('changing a deleted comment names it instead of writing it back', async () => {
    const { figma } = await document()
    const run = compileScript(`
      const comment = openpencil.addComment('Gone')
      comment.remove()
      comment.resolve()
    `)
    await expect(run(figma)).rejects.toThrow('was deleted')
  })
})
