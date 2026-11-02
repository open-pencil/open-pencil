import { expect, test } from 'bun:test'

import { generatedFrameCodec } from '#fig/node-change/generated/codecs'

import { GENERATED_FRAME_TYPES } from '@open-pencil/scene-graph/generated'

test('every generated frame type is read and written through a codec', () => {
  for (const type of GENERATED_FRAME_TYPES)
    expect({ type, codec: !!generatedFrameCodec(type) }).toEqual({ type, codec: true })
})
