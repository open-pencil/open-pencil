import { describe, expect, test } from 'bun:test'

import {
  duplicateComponentNames,
  singleWordComponentNames
} from '../src/steiger-rules/component-names'

describe('unique component names', () => {
  test('finds app components that share a file name', () => {
    expect(
      duplicateComponentNames([
        'src/components/chat/turn/Message.vue',
        'src/components/comments/Message.vue',
        'src/components/chat/ChatPanel.vue'
      ])
    ).toEqual(
      new Map([
        [
          'Message.vue',
          ['src/components/chat/turn/Message.vue', 'src/components/comments/Message.vue']
        ]
      ])
    )
  })

  test('leaves story examples and files outside the app components alone', () => {
    expect(
      duplicateComponentNames([
        'src/components/navigation/examples/States.vue',
        'src/components/LayerTree/examples/States.vue',
        'src/views/Editor.vue',
        'src/components/editor/Editor.vue',
        'src/components/chat/state.ts',
        'src/components/chat/state/index.ts'
      ])
    ).toEqual(new Map())
  })

  test('finds one-word component names, except the allowed ones and story examples', () => {
    expect(
      singleWordComponentNames([
        'src/components/shell/Toaster.vue',
        'src/components/shell/AppToaster.vue',
        'src/components/ui/overlay/Tip.vue',
        'src/components/navigation/examples/States.vue',
        'src/views/Editor.vue'
      ])
    ).toEqual(['src/components/shell/Toaster.vue'])
  })
})
