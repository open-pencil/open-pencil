import { describe, expect, test } from 'bun:test'
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { FONT_FIXTURES, fontCollection } from '#cli-tests/helpers/fonts'

import { fontFaceName, UnsupportedFontFormatError } from '@open-pencil/core/text'

import {
  chooseInstalledFace,
  FONT_DIRS_ENV,
  listInstalledFaces,
  loadInstalledFont,
  systemFontDirectories,
  type InstalledFace
} from '#cli/fonts/system'

function installed(face: Partial<InstalledFace> & Pick<InstalledFace, 'family' | 'style'>) {
  return {
    legacy: null,
    instances: [],
    weight: 400,
    italic: false,
    normalWidth: true,
    weightAxis: null,
    drawable: true,
    path: `${face.family}-${face.style}.ttf`,
    face: { index: 0, offset: 0, tables: [] },
    ...face
  } satisfies InstalledFace
}

/** Hiragino Sans as macOS installs it: one file per weight, each named by its weight number. */
const HIRAGINO = [
  installed({ family: 'Hiragino Sans', style: 'W3', weight: 300 }),
  installed({ family: 'Hiragino Sans', style: 'W4', weight: 400 }),
  installed({ family: 'Hiragino Sans', style: 'W6', weight: 600 })
]

async function fontFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'open-pencil-system-fonts-'))
  await mkdir(join(folder, 'nested'))
  await copyFile(FONT_FIXTURES.interVariable, join(folder, 'InterVariable.ttf'))
  await copyFile(FONT_FIXTURES.cjk, join(folder, 'nested', 'NotoSansCJK-Test.OTF'))
  await writeFile(
    join(folder, 'Pair.ttc'),
    await fontCollection([FONT_FIXTURES.interSemiBold, FONT_FIXTURES.naskh])
  )
  await writeFile(join(folder, 'Broken.ttf'), new Uint8Array(40))
  await writeFile(join(folder, 'README.txt'), 'not a font')
  return folder
}

describe('systemFontDirectories', () => {
  test('lists the folders OPENPENCIL_FONT_DIRS names in place of the system ones', async () => {
    const env = { [FONT_DIRS_ENV]: ['/a', '', '/b'].join(delimiter) }
    expect(await systemFontDirectories(env, 'linux', '/home/me')).toEqual(['/a', '/b'])
    expect(await systemFontDirectories({ [FONT_DIRS_ENV]: '' }, 'darwin', '/Users/me')).toEqual([])
  })

  test('lists the XDG font folders on Linux', async () => {
    const env = { XDG_DATA_HOME: '/data', XDG_DATA_DIRS: '/usr/share:/opt/share' }
    expect(await systemFontDirectories(env, 'linux', '/home/me')).toEqual([
      '/home/me/.fonts',
      '/data/fonts',
      '/usr/share/fonts',
      '/opt/share/fonts'
    ])
  })

  test("lists the system's and the user's font folders on Windows", async () => {
    const env = { WINDIR: 'D:\\Windows', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' }
    expect(await systemFontDirectories(env, 'win32', 'C:\\Users\\me')).toEqual([
      join('D:\\Windows', 'Fonts'),
      join('C:\\Users\\me\\AppData\\Local', 'Microsoft', 'Windows', 'Fonts')
    ])
  })
})

describe('listInstalledFaces', () => {
  test('describes each face of the font files in a folder and its subfolders', async () => {
    const faces = await listInstalledFaces([await fontFolder()])
    expect(
      faces.map(({ family, style, weight, weightAxis }) => ({ family, style, weight, weightAxis }))
    ).toEqual([
      { family: 'Inter Variable', style: 'Regular', weight: 400, weightAxis: [100, 900] },
      { family: 'Inter', style: 'SemiBold', weight: 600, weightAxis: null },
      { family: 'Noto Naskh Arabic', style: 'Regular', weight: 400, weightAxis: null },
      { family: 'Noto Sans CJK SC', style: 'Regular', weight: 400, weightAxis: null }
    ])
    expect(faces[0]?.instances).toContain('SemiBold')
    // Inter's SemiBold names a legacy family of its own, as Windows lists it.
    expect(faces[1]?.legacy).toEqual({ family: 'Inter SemiBold', style: 'Regular' })
    expect(faces[0]?.legacy).toBeNull()
  })
})

describe('chooseInstalledFace', () => {
  test('picks a face by the weight its font gives it when the style only names a weight', () => {
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'Regular')?.style).toBe('W4')
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'SemiBold')?.style).toBe('W6')
    expect(chooseInstalledFace(HIRAGINO, 'hiragino sans', 'Semi Bold')?.style).toBe('W6')
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'Bold')).toBeUndefined()
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'Italic')).toBeUndefined()
  })

  test("picks a face by the font's own style name", () => {
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'W3')?.style).toBe('W3')
    // A name of its own is that face or none, never another face of its weight.
    expect(chooseInstalledFace(HIRAGINO, 'Hiragino Sans', 'Book')).toBeUndefined()
  })

  test('prefers a normal-width face and reaches weights along a variable axis', () => {
    const faces = [
      installed({ family: 'Sans', style: 'Condensed Bold', weight: 700, normalWidth: false }),
      installed({ family: 'Sans', style: 'Bold', weight: 700 }),
      installed({ family: 'Sans', style: 'Light Italic', weight: 300, italic: true }),
      installed({ family: 'Flex', style: 'Regular', weightAxis: [100, 900], instances: ['Medium'] })
    ]
    expect(chooseInstalledFace(faces, 'Sans', 'Bold')?.style).toBe('Bold')
    expect(chooseInstalledFace(faces, 'Sans', 'Light Italic')?.style).toBe('Light Italic')
    expect(chooseInstalledFace(faces, 'Flex', 'Medium')?.style).toBe('Regular')
    expect(chooseInstalledFace(faces, 'Flex Variable', 'ExtraBold')?.style).toBe('Regular')
  })
})

describe('chooseInstalledFace with legacy family names', () => {
  /** Segoe UI as Windows installs it: faces beyond regular and bold name legacy families. */
  const SEGOE = [
    installed({ family: 'Segoe UI', style: 'Regular' }),
    installed({
      family: 'Segoe UI',
      style: 'Semibold',
      weight: 600,
      legacy: { family: 'Segoe UI Semibold', style: 'Regular' }
    }),
    installed({
      family: 'Segoe UI',
      style: 'Semibold Italic',
      weight: 600,
      italic: true,
      legacy: { family: 'Segoe UI Semibold', style: 'Italic' }
    })
  ]

  test('finds a face under the family Windows lists it in', () => {
    expect(chooseInstalledFace(SEGOE, 'Segoe UI Semibold', 'Regular')?.style).toBe('Semibold')
    expect(chooseInstalledFace(SEGOE, 'Segoe UI Semibold', 'Italic')?.style).toBe('Semibold Italic')
    expect(chooseInstalledFace(SEGOE, 'Segoe UI Semibold', 'Semibold')?.style).toBe('Semibold')
  })

  test('still finds the face under the family its font names', () => {
    expect(chooseInstalledFace(SEGOE, 'Segoe UI', 'Semibold')?.style).toBe('Semibold')
    expect(chooseInstalledFace(SEGOE, 'Segoe UI', 'Regular')?.style).toBe('Regular')
  })
})

describe('loadInstalledFont', () => {
  test("returns a collection face's data standing alone", async () => {
    const faces = await listInstalledFaces([await fontFolder()])
    const data = await loadInstalledFont(faces, 'Noto Naskh Arabic', 'Regular')
    expect(data && fontFaceName(data)).toEqual({ family: 'Noto Naskh Arabic', style: 'Regular' })
    expect(await loadInstalledFont(faces, 'Hiragino Sans', 'Regular')).toBeNull()
  })

  test('loads a face by the legacy family Windows lists it under', async () => {
    const faces = await listInstalledFaces([await fontFolder()])
    const data = await loadInstalledFont(faces, 'Inter SemiBold', 'Regular')
    expect(data && fontFaceName(data)).toEqual({ family: 'Inter', style: 'SemiBold' })
  })

  test('reports a family whose installed faces cannot be drawn', async () => {
    const faces = [installed({ family: 'PingFang SC', style: 'Regular', drawable: false })]
    await expect(loadInstalledFont(faces, 'PingFang SC', 'Regular')).rejects.toBeInstanceOf(
      UnsupportedFontFormatError
    )
  })
})
