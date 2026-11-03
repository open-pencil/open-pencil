import { describe, expect, test } from 'bun:test'

import { commandLink, commandsAsText, leadingCommand } from '@/app/ai/chat/references/command'
import { findReferences, referenceLink } from '@/app/ai/chat/references/link'

describe('commands chosen from /', () => {
  test('are reference links the chat reads as the command they name', () => {
    expect(findReferences(commandLink('compact')).map(({ reference }) => reference)).toEqual([
      { kind: 'command', id: 'compact', label: '/compact' }
    ])
    expect(leadingCommand(`  ${commandLink('compact')} keep the colors `)).toEqual({
      name: 'compact',
      rest: 'keep the colors'
    })
    expect(leadingCommand(commandLink('skill:grid'))).toEqual({ name: 'skill:grid', rest: '' })
  })

  test('only a command the message starts with counts', () => {
    expect(leadingCommand('/compact keep the colors')).toBeNull()
    expect(leadingCommand(`Hi ${commandLink('compact')}`)).toBeNull()
    const hero = referenceLink({ kind: 'node', id: '1:2', label: 'Hero' })
    expect(leadingCommand(`${hero} ${commandLink('compact')}`)).toBeNull()
  })

  test('reach agents and models written out, while other references stay links', () => {
    const hero = referenceLink({ kind: 'node', id: '1:2', label: 'Hero' })
    expect(commandsAsText(`${commandLink('review')} the ${hero}`)).toBe(`/review the ${hero}`)
    expect(commandsAsText('plain text')).toBe('plain text')
  })
})
