import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { addComment, getComments, replyToComment, resolveComment } from '#core/tools/comments'

interface Listed {
  comments: { id: string; resolved: boolean; replies: { author: string }[] }[]
}

function isListed(value: unknown): value is Listed {
  return typeof value === 'object' && value !== null && 'comments' in value
}

async function list(figma: FigmaAPI, includeResolved?: boolean): Promise<Listed['comments']> {
  const result = await getComments.execute(figma, { includeResolved })
  if (!isListed(result)) throw new Error(`Unexpected result: ${JSON.stringify(result)}`)
  return result.comments
}

describe('comment tools', () => {
  test('agents read open comments, reply, and resolve them', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    await addComment.execute(figma, { text: 'Align the button', x: 20, y: 30, author: 'Dana' })
    const [comment] = await list(figma)
    if (!comment) throw new Error('No comment listed')

    await replyToComment.execute(figma, { id: comment.id, text: 'Aligned to the card edge' })
    await resolveComment.execute(figma, { id: comment.id })

    expect(await list(figma)).toEqual([])
    const [resolved] = await list(figma, true)
    expect(resolved).toMatchObject({ id: comment.id, resolved: true, replies: [{ author: 'Agent' }] })
  })

  test('an unknown comment is reported, not created', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await resolveComment.execute(figma, { id: 'c_missing' })).toEqual({
      error: 'No comment c_missing'
    })
    expect(await list(figma, true)).toEqual([])
  })
})
