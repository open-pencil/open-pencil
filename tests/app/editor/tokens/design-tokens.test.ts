import { describe, expect, test } from 'bun:test'
import { strToU8, zipSync } from 'fflate'

import { readDesignTokenImport } from '@/app/editor/tokens/design-tokens'

const resolver = {
  version: '2025-11-01',
  sets: {
    Primitive: { sources: [{ $ref: 'Primitive/Mode 1.tokens.json' }] }
  },
  resolutionOrder: [{ $ref: '#/sets/Primitive' }]
}

const primitiveMode = {
  color: { $type: 'color', brand: { $value: '#2563eb' } },
  $extensions: { 'dev.openpencil': { collection: 'Primitive', mode: 'Mode 1', default: true } }
}

/** A picked file, with the folder path a folder pick records on it. */
function pickedFile(name: string, content: string, relativePath = ''): File {
  const file = new File([content], name, { type: 'application/json' })
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('readDesignTokenImport', () => {
  test('a folder import skips an incidental invalid zip and still imports the valid tokens', async () => {
    const bundle = await readDesignTokenImport([
      pickedFile(
        'tokens.resolver.json',
        JSON.stringify(resolver),
        'tokens/tokens.resolver.json'
      ),
      pickedFile(
        'Mode 1.tokens.json',
        JSON.stringify(primitiveMode),
        'tokens/Primitive/Mode 1.tokens.json'
      ),
      // An unrelated archive sitting in the picked folder: not a token archive, and
      // unpacking it would throw and abort the whole import.
      pickedFile('junk.zip', 'not a zip', 'tokens/junk.zip')
    ])

    expect(bundle.collections.map((collection) => collection.name)).toEqual(['Primitive'])
    const [primitive] = bundle.collections
    expect(primitive.modes.map((mode) => mode.name)).toEqual(['Mode 1'])
    const [mode] = primitive.modes
    expect(mode.tokens.some((token) => token.value === '#2563eb')).toBe(true)
  })

  test('a zip picked on its own still unpacks as a token archive', async () => {
    const archive = zipSync({
      'tokens.resolver.json': strToU8(JSON.stringify(resolver)),
      'Primitive/Mode 1.tokens.json': strToU8(JSON.stringify(primitiveMode))
    })
    const bundle = await readDesignTokenImport([
      new File([archive], 'tokens.zip', { type: 'application/zip' })
    ])

    expect(bundle.collections.map((collection) => collection.name)).toEqual(['Primitive'])
  })
})
