import { describe, expect, it } from 'bun:test'

import {
  FIG_PACKAGE_STATUS,
  assertFigPackageReady,
  readFigContainer,
  writeFigContainer
} from '../src/index'

describe('@open-pencil/fig package API', () => {
  it('exports container API status', () => {
    expect(FIG_PACKAGE_STATUS).toBe('container-api')
  })

  it('round-trips fig-kiwi container bytes', () => {
    const bytes = writeFigContainer({
      schemaDeflated: new Uint8Array([1, 2, 3]),
      dataRaw: new Uint8Array([4, 5, 6])
    })
    const document = readFigContainer(bytes, { fileName: 'fixture.fig' })

    expect(document.schemaDeflated).toEqual(new Uint8Array([1, 2, 3]))
    expect(document.dataRaw).toEqual(new Uint8Array([4, 5, 6]))
    expect(document.source?.bytes).toBe(bytes)
    expect(document.source?.fileName).toBe('fixture.fig')
  })

  it('rejects invalid fig-kiwi containers', () => {
    expect(() => readFigContainer(new Uint8Array([1, 2, 3]))).toThrow('Invalid fig-kiwi')
  })

  it('directs consumers to core for SceneGraph read/write', () => {
    expect(() => assertFigPackageReady()).toThrow('low-level container APIs')
  })
})
