import { describe, expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '@open-pencil/test-support/paths'

import { OwnFaceNames, readLocalFace } from '#core/text/font/local'
import { fontFaceName } from '#core/text/font/variation'

/** Names itself "Inter Variable", with opsz and wght axes and a "Display Heavy" instance. */
const INTER_VARIABLE = readFixtureArrayBuffer('fonts/InterVariable-Named.ttf')
/** A static face whose font names another family. */
const NASKH = readFixtureArrayBuffer('fonts/NotoNaskhArabic-Regular.ttf')

function localFace(
  family: string,
  style: string,
  bytes: ArrayBuffer,
  reads?: string[],
  fullName = `${family} ${style}`
): FontData {
  return {
    family,
    style,
    fullName,
    postscriptName: fullName.replaceAll(' ', '-'),
    blob: () => {
      reads?.push(fullName)
      return Promise.resolve(new Blob([bytes]))
    }
  }
}

async function familyOf(data: Promise<ArrayBuffer | null>) {
  const bytes = await data
  return bytes && fontFaceName(bytes)?.family
}

describe('readLocalFace', () => {
  test('finds a face Windows lists under a family and style of its own by its font’s names', async () => {
    // As Windows lists Segoe UI Variable: a family per optical size, the style words reordered.
    const fonts = [
      localFace('Inter Variable Heavy', 'Display', INTER_VARIABLE),
      localFace('Inter Variable Text', 'Regular', INTER_VARIABLE)
    ]
    expect(await familyOf(readLocalFace(fonts, 'Inter Variable', 'Display Heavy'))).toBe(
      'Inter Variable'
    )
    expect(await familyOf(readLocalFace(fonts, 'Inter Variable', 'Regular'))).toBe('Inter Variable')
  })

  test('takes the font that names itself the family over the family it normalizes to', async () => {
    const fonts = [
      localFace('Inter', 'Bold', NASKH),
      localFace('Inter Variable Text', 'Regular', INTER_VARIABLE)
    ]
    expect(await familyOf(readLocalFace(fonts, 'Inter Variable', 'Bold'))).toBe('Inter Variable')
    expect(await familyOf(readLocalFace(fonts, 'Inter Variable', 'SemiBold'))).toBe(
      'Inter Variable'
    )
  })

  test('still takes the normalized family when no font names itself the family', async () => {
    const fonts = [localFace('Inter', 'Bold', NASKH)]
    expect(await familyOf(readLocalFace(fonts, 'Inter Variable', 'Bold'))).toBe('Noto Naskh Arabic')
  })

  test('finds no face its font does not name, nor one whose font names another family', async () => {
    const fonts = [
      localFace('Inter Variable Text', 'Regular', INTER_VARIABLE),
      localFace('Inter Variable Display', 'Heavy', NASKH)
    ]
    expect(await readLocalFace(fonts, 'Inter Variable', 'Compressed Heavy')).toBeNull()
    expect(await readLocalFace([fonts[1]], 'Inter Variable', 'Heavy Display')).toBeNull()
  })

  test('reads each listed face’s names once, and the face whose full name fits first', async () => {
    const reads: string[] = []
    const fonts = [
      localFace('Inter Variable Small', 'Regular', INTER_VARIABLE, reads),
      localFace('Inter Variable Heavy', 'Display', INTER_VARIABLE, reads),
      localFace('Inter Variable Noto', 'Regular', NASKH, reads)
    ]
    const names = new OwnFaceNames()
    await readLocalFace(fonts, 'Inter Variable', 'Display Heavy', names)
    expect(reads).toEqual(['Inter Variable Heavy Display'])

    reads.length = 0
    expect(await readLocalFace(fonts, 'Inter Variable', 'Compressed', names)).toBeNull()
    expect(reads).toEqual(['Inter Variable Small Regular', 'Inter Variable Noto Regular'])
    reads.length = 0
    expect(await readLocalFace(fonts, 'Inter Variable', 'Compressed', names)).toBeNull()
    expect(reads).toEqual([])
  })
})

describe('the names a local face’s own font gives it', () => {
  // As Edge on Windows lists the installed fixture: its optical size's family, STAT-ordered styles.
  const windows = () => [
    localFace('Inter Variable Text', 'Text', INTER_VARIABLE, [], 'Inter Variable Text'),
    localFace('Inter Variable Text', 'Text Bold', INTER_VARIABLE, [], 'Inter Variable Text Bold')
  ]

  test('a face read by its listed names learns its font’s family and style', async () => {
    const names = new OwnFaceNames()
    await readLocalFace(windows(), 'Inter Variable Text', 'Bold', names)
    const bold = { family: 'Inter Variable', style: 'Bold' }
    expect(names.ownFace('Inter Variable Text', 'Bold')).toEqual(bold)
    expect(names.ownFace('Inter Variable Text', 'Text Bold')).toEqual(bold)
    expect(names.families()).toEqual(['Inter Variable'])
    expect(names.familyFaces('inter variable')?.map((face) => [face.style, face.weight])).toEqual([
      ['Thin', 100],
      ['ExtraLight', 200],
      ['Light', 300],
      ['Regular', 400],
      ['Medium', 500],
      ['SemiBold', 600],
      ['Bold', 700],
      ['ExtraBold', 800],
      ['Black', 900],
      ['Display Heavy', 850]
    ])
  })

  test('a face asked for by its font’s own names learns no other names for that request', async () => {
    const names = new OwnFaceNames()
    let changes = 0
    names.onChange(() => changes++)
    await readLocalFace(windows(), 'Inter Variable', 'Bold', names)
    expect(names.ownFace('Inter Variable', 'Bold')).toBeUndefined()
    // Found by its weight axis in the first face listed, which is Regular, not Bold.
    await readLocalFace(windows(), 'Inter Variable Text', 'SemiBold', names)
    expect(names.ownFace('Inter Variable Text', 'SemiBold')).toEqual({
      family: 'Inter Variable',
      style: 'SemiBold'
    })
    expect(names.families()).toEqual(['Inter Variable'])
    await readLocalFace(windows(), 'Inter Variable Text', 'Text', names)
    expect(changes).toBe(1)
  })

  test('learns nothing from a face listed under the family its font names', async () => {
    const names = new OwnFaceNames()
    await readLocalFace(
      [localFace('Inter Variable', 'Regular', INTER_VARIABLE)],
      'Inter Variable',
      'Regular',
      names
    )
    expect(names.ownFace('Inter Variable', 'Regular')).toBeUndefined()
    expect(names.families()).toEqual([])
  })
})
