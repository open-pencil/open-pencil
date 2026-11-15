import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import {
  duplicateComponentNames,
  multiWordComponentNames,
  singleWordComponentNames,
  uniqueComponentNames
} from '../src/steiger-rules/component-names'

/** A repository tree holding `files`, as Steiger hands it to a rule. */
function tree(files: string[]) {
  const root = '/repo'
  return {
    type: 'folder' as const,
    path: root,
    children: files.map((file) => ({ type: 'file' as const, path: join(root, file) }))
  }
}

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

  test('the rule reports each of the files that share a name', () => {
    const { diagnostics } = uniqueComponentNames.check(
      tree(['src/components/chat/turn/ChatMessage.vue', 'src/components/chat/ChatMessage.vue'])
    )
    expect(diagnostics.map((diagnostic) => diagnostic.location.path)).toEqual([
      '/repo/src/components/chat/turn/ChatMessage.vue',
      '/repo/src/components/chat/ChatMessage.vue'
    ])
  })
})

describe('multi-word component names', () => {
  test('finds one-word component names, except the allowed ones and story examples', () => {
    expect(
      singleWordComponentNames([
        'src/components/shell/Toaster.vue',
        'src/components/shell/AppToaster.vue',
        'src/components/icons/SVG.vue',
        'src/components/icons/SVGIcon.vue',
        'src/components/ui/overlay/Tip.vue',
        'src/components/navigation/examples/States.vue',
        'src/views/Editor.vue'
      ])
    ).toEqual(['src/components/shell/Toaster.vue', 'src/components/icons/SVG.vue'])
  })

  test('the rule reports each one-word component', () => {
    const { diagnostics } = multiWordComponentNames.check(
      tree(['src/components/shell/Toaster.vue', 'src/components/shell/AppShell.vue'])
    )
    expect(diagnostics.map((diagnostic) => diagnostic.location.path)).toEqual([
      '/repo/src/components/shell/Toaster.vue'
    ])
  })
})
