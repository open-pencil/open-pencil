import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI, registerTestFont } from '#core-tests/helpers/figma-api'


beforeAll(() => registerTestFont())

const RED = [{ type: 'SOLID' as const, color: { r: 1, g: 0, b: 0 } }]

function coloured(characters: string, start: number, end: number) {
  const api = createAPI()
  const text = api.createText()
  text.characters = characters
  text.setRangeFills(start, end, RED)
  return text
}

function redCharacters(text: ReturnType<typeof coloured>) {
  return text
    .getStyledTextSegments(['fills'])
    .filter((segment) => {
      const [fill] = segment.fills as typeof RED
      return fill?.color.r === 1 && fill.color.g === 0
    })
    .map((segment) => segment.characters)
}

// Recorded with the same scripts in Figma 126.
describe('editing coloured text through the plugin API', () => {
  test('inserting before a coloured run moves the run with its characters', () => {
    const text = coloured('one two three', 4, 7)
    text.insertCharacters(0, 'zero ')

    expect(text.characters).toBe('zero one two three')
    expect(redCharacters(text)).toEqual(['two'])
  })

  test('inserted characters copy the preceding character, so typing on after a run extends it', () => {
    const text = coloured('one two three', 4, 7)
    text.insertCharacters(7, 's')

    expect(redCharacters(text)).toEqual(['twos'])
  })

  test('with AFTER, inserted characters copy the following character', () => {
    const text = coloured('one two three', 4, 7)
    text.insertCharacters(4, 'big ', 'AFTER')
    text.insertCharacters(11, '!', 'AFTER')

    expect(text.characters).toBe('one big two! three')
    expect(redCharacters(text)).toEqual(['big two'])
  })

  test('at the start of the text, inserted characters copy the closest character', () => {
    const text = coloured('two three', 0, 3)
    text.insertCharacters(0, 'one ')

    expect(redCharacters(text)).toEqual(['one two'])
  })

  test('a long insert keeps the styles around it', () => {
    const text = coloured('one two three', 4, 7)
    const long = 'x'.repeat(200_000)
    text.insertCharacters(4, long, 'AFTER')

    expect(text.characters.length).toBe(13 + long.length)
    // Read back a few ranges: listing every segment of 200,000 characters is slow in itself.
    const red = (start: number, end: number) =>
      (text.getRangeFills(start, end) as typeof RED)[0]?.color.r
    expect([red(4, 5), red(4 + long.length, 7 + long.length)]).toEqual([1, 1])
    // Before the run, the text keeps its own black.
    expect(red(0, 4)).toBe(0)
  })

  test('deleting before a coloured run moves the run with its characters', () => {
    const text = coloured('one two three', 8, 13)
    text.deleteCharacters(0, 4)

    expect(redCharacters(text)).toEqual(['three'])
  })

  test('deleting across the start of a coloured run keeps the characters left in it', () => {
    const text = coloured('one two three', 8, 13)
    text.deleteCharacters(6, 10)

    expect(text.characters).toBe('one twree')
    expect(redCharacters(text)).toEqual(['ree'])
  })

  test('deleting inside a coloured run shortens the run and keeps the rest coloured', () => {
    const text = coloured('one seven three', 4, 9)
    text.deleteCharacters(5, 7)

    expect(text.characters).toBe('one sen three')
    expect(redCharacters(text)).toEqual(['sen'])
  })

  test('setting characters resets range styles, leaving the style of the first character', () => {
    const middle = coloured('one two three', 4, 7)
    middle.characters = 'one six three'
    expect(redCharacters(middle)).toEqual([])

    const first = coloured('one two three', 0, 3)
    first.characters = 'six seven'
    expect(redCharacters(first)).toEqual(['six seven'])
  })

  // Messages recorded in Figma 126.
  test('an unknown useStyle is refused', () => {
    const text = coloured('one', 0, 1)
    expect(() => text.insertCharacters(0, 'x', 'MIDDLE' as never)).toThrow(
      'in insertCharacters: Property "useStyle" failed validation: Invalid option: expected one of "BEFORE"|"AFTER"'
    )
  })

  test('insert and delete positions outside the text are refused and change nothing', () => {
    const text = coloured('one two three', 4, 7)

    expect(() => text.insertCharacters(14, 'x')).toThrow(
      'in insertCharacters: Cannot insert characters at index greater than the length of the text'
    )
    expect(() => text.insertCharacters(-1, 'x')).toThrow(
      'in insertCharacters: Property "start" failed validation: Too small: expected number to be >=0'
    )
    expect(() => text.insertCharacters(1.5, 'x')).toThrow(
      'in insertCharacters: Property "start" failed validation: Expected int, received number'
    )
    expect(() => text.deleteCharacters(-1, 3)).toThrow(
      'in deleteCharacters: Property "start" failed validation: Too small: expected number to be >=0'
    )
    expect(() => text.deleteCharacters(0, 14)).toThrow(
      'in deleteCharacters: Cannot delete characters at index greater than the length of the text'
    )
    expect(() => text.deleteCharacters(5, 3)).toThrow(
      'in deleteCharacters: deleteCharacters must have (start <= end)'
    )

    expect(text.characters).toBe('one two three')
    expect(redCharacters(text)).toEqual(['two'])
  })

  test('the end of the text is a valid place to insert and to end a deletion', () => {
    const text = coloured('one two three', 4, 7)
    text.insertCharacters(13, '!')
    text.deleteCharacters(12, 14)

    expect(text.characters).toBe('one two thre')
    expect(redCharacters(text)).toEqual(['two'])
  })
})
