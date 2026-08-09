import { describe, expect, test } from 'bun:test'

import { speakerNotesLexical, speakerNotesPlainText } from '../src/slides-notes'

/**
 * Figma serialises speaker notes as a Lexical editor state. Rendering that
 * verbatim showed every imported deck its own JSON where the speaker's words
 * belong, so reading a note MUST yield text a person can read.
 */
describe('speakerNotesPlainText', () => {
  test('reads the words out of a Figma note', () => {
    const lexical = JSON.stringify({
      root: {
        children: [
          {
            children: [{ detail: 0, format: 0, mode: 'normal', text: 'OpenPencil is free.' }],
            type: 'paragraph'
          }
        ],
        type: 'root'
      }
    })

    expect(speakerNotesPlainText(lexical)).toBe('OpenPencil is free.')
  })

  test('separates paragraphs', () => {
    const lexical = JSON.stringify({
      root: {
        children: [
          { children: [{ text: 'First.' }], type: 'paragraph' },
          { children: [{ text: 'Second.' }], type: 'paragraph' }
        ]
      }
    })

    expect(speakerNotesPlainText(lexical)).toBe('First.\n\nSecond.')
  })

  test('a linebreak node does not run two words together', () => {
    const lexical = JSON.stringify({
      root: {
        children: [
          { children: [{ text: 'one' }, { type: 'linebreak' }, { text: 'two' }], type: 'paragraph' }
        ]
      }
    })

    expect(speakerNotesPlainText(lexical)).toBe('one\ntwo')
  })

  test('plain notes typed in OpenPencil pass through untouched', () => {
    expect(speakerNotesPlainText('Remember to slow down here.')).toBe('Remember to slow down here.')
  })

  test('a note that merely begins with a brace is still a note', () => {
    // The check is the shape of the value, not a guess at its origin.
    expect(speakerNotesPlainText('{not json at all')).toBe('{not json at all')
  })

  test('JSON that is not a Lexical state is left alone', () => {
    expect(speakerNotesPlainText('{"note":"hi"}')).toBe('{"note":"hi"}')
  })

  test('an empty Lexical state reads as an empty note', () => {
    // Falling back to the raw value here would show JSON for a blank note.
    expect(speakerNotesPlainText(JSON.stringify({ root: { children: [] } }))).toBe('')
  })

  test('text survives the round trip through a Lexical state', () => {
    // Editing an imported note used to replace a valid editor state with bare
    // text, which only this app could read. Writing Lexical back is what keeps
    // the note intact through the deck round trip.
    const text = 'First line.\nSecond line.\n\nA new paragraph.'

    expect(speakerNotesPlainText(speakerNotesLexical(text))).toBe(text)
  })

  test('a written note is a Lexical document, not bare text', () => {
    const written = JSON.parse(speakerNotesLexical('Hello.')) as {
      root: { type: string; children: { type: string; children: { text: string }[] }[] }
    }

    expect(written.root.type).toBe('root')
    expect(written.root.children[0]?.type).toBe('paragraph')
    expect(written.root.children[0]?.children[0]?.text).toBe('Hello.')
  })
})
