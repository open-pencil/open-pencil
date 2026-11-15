import { join } from 'node:path'

import {
  createHTMLEngineRuntime,
  loadHTMLEngine,
  type HTMLEngineRuntimeOptions
} from '@open-pencil/html-engine'
import { FIXTURES } from '@open-pencil/test-support/paths'

/** The engine with the repository's Latin subset of Inter as its sans-serif font, so text has lines. */
export async function engineWithInter() {
  const engine = await loadHTMLEngine()
  engine.addFont(await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes())
  engine.setGenericFamily('sans-serif', ['Inter Variable', 'Inter'])
  return engine
}

/** A CSS runtime on that engine, as the tests style documents with. */
export function engineRuntime(options: HTMLEngineRuntimeOptions = {}) {
  return createHTMLEngineRuntime({ ...options, engine: engineWithInter })
}
