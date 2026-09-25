import { expect, test } from 'bun:test'

import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

function records(): NodeChange[] {
  return [
    { guid: guid(1), type: 'CANVAS' },
    {
      guid: guid(2),
      type: 'SYMBOL',
      name: 'Retained',
      parentIndex: { guid: guid(1), position: '!' },
      ancestorPathBeforeDeletion: [guid(99)]
    },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      textData: { characters: 'Retained content' }
    }
  ] as NodeChange[]
}

test('deletion history alone does not remove a node from the current hierarchy', () => {
  const input = records()
  const reader = createDocumentReader(input)
  expect(reader.readPage('1:1').children.map((node) => node.sourceId)).toEqual(['1:2'])
  expect(reader.readComponent('1:2').children[0].properties.textData?.characters).toBe(
    'Retained content'
  )
  expect(input[1].parentIndex?.guid).toEqual(guid(1))
})

test('references and current hierarchy both retain definitions with deletion history', () => {
  const input = records()
  input.push({
    guid: guid(4),
    type: 'INSTANCE',
    parentIndex: { guid: guid(1), position: '"' },
    symbolData: { symbolID: guid(2) }
  })
  const page = createDocumentReader(input).readPage('1:1')
  expect(page.children.map((node) => node.sourceId)).toEqual(['1:2', '1:4'])
  expect(page.children[1].children[0].properties.textData?.characters).toBe('Retained content')
})
