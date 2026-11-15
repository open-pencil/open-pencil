import { describe, expect, test } from 'bun:test'

import { readFixtureBytes, uint8ArrayToArrayBuffer } from '@open-pencil/test-support/paths'

import { OwnFaceNames, readLocalFace } from '#core/text/font/local'
import { fontFaceName } from '#core/text/font/variation'

/** Names itself "Inter Variable", with opsz and wght axes and a "Display Heavy" instance. */
const INTER_VARIABLE = uint8ArrayToArrayBuffer(readFixtureBytes('fonts/InterVariable-Named.ttf'))
/** A static face whose font names another family. */
const NASKH = uint8ArrayToArrayBuffer(readFixtureBytes('fonts/NotoNaskhArabic-Regular.ttf'))

function localFace(family: string, style: string, bytes: ArrayBuffer, reads?: string[]): FontData {
  const fullName = `${family} ${style}`
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
