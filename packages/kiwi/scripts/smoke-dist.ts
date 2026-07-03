import { getSchemaBytes, initCodec, isCodecReady } from '../dist/fig/codec.js'
import { buildFigKiwi, parseFigKiwiChunks } from '../dist/fig/container.js'
import { guidToString } from '../dist/fig/guid.js'
import { parseFigKiwiContainer } from '../dist/fig/parse.js'
import { figmaSchema, getKiwiMessageType, parseSchema, validateSchema } from '../dist/index.js'

const schema = parseSchema(`
message Smoke {
  uint id = 1;
}
`)
validateSchema(schema)
validateSchema(figmaSchema)

if (figmaSchema.definitions.length !== 605) {
  throw new Error(`Unexpected Figma schema definition count: ${figmaSchema.definitions.length}`)
}

if (getKiwiMessageType(new Uint8Array([1, 3, 0])) !== 3) {
  throw new Error('Failed to read Kiwi message type from built dist')
}

await initCodec()

if (!isCodecReady() || getSchemaBytes().length === 0) {
  throw new Error('Failed to initialize built FIG codec')
}

if (parseFigKiwiContainer(new TextEncoder().encode('not-fig-kiwi')) !== null) {
  throw new Error('Failed to reject invalid FIG Kiwi container')
}

const figKiwi = buildFigKiwi(new Uint8Array([1]), new Uint8Array([2]))
if (parseFigKiwiChunks(figKiwi)?.length !== 2) {
  throw new Error('Failed to read built FIG Kiwi container chunks')
}

if (guidToString({ sessionID: 1, localID: 2 }) !== '1:2') {
  throw new Error('Failed to format built FIG GUID helper')
}
