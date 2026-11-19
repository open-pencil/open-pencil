import { describe, expect, test } from 'bun:test'

import type { KeyBinding } from '@codemirror/view'
import { compact } from 'es-toolkit'

import { editorCommandMetadata } from '@open-pencil/vue/editor/commands'

import type { AppMenuGroupSchema } from '@/app/shell/menu/schema'
import {
  appMenuShortcut,
  appMenuShortcuts,
  menuShortcuts,
  shortcutToAccelerator
} from '@/app/shell/menu/shortcut'
import { withoutMenuKeys } from '@/components/code-editor/keys'

describe('app menu shortcuts', () => {
  test('looks up shortcuts from the menu schema and editor commands', () => {
    expect(appMenuShortcut('save-as')).toBe('Mod+Shift+S')
    expect(appMenuShortcut('selection.createComponent')).toBe('Mod+Alt+K')
  })

  test('converts shortcuts to native accelerators', () => {
    expect(shortcutToAccelerator('Mod+Shift+S')).toBe('CmdOrCtrl+Shift+S')
    expect(shortcutToAccelerator('Alt+A')).toBe('Alt+A')
    expect(shortcutToAccelerator('Control+Shift+Tab')).toBe('Ctrl+Shift+Tab')
    expect(shortcutToAccelerator('Control+Meta+M')).toBe('Ctrl+Super+M')
    expect(shortcutToAccelerator('Mod+Alt+Enter')).toBe('CmdOrCtrl+Alt+Enter')
    expect(shortcutToAccelerator('Backspace')).toBe('Backspace')
    expect(shortcutToAccelerator('PageDown')).toBe('PageDown')
  })
})

describe('menu keys in text fields', () => {
  const groups: AppMenuGroupSchema[] = [
    {
      label: 'Edit',
      items: [
        { id: 'edit.undo', label: 'Undo', command: 'edit.undo' },
        { id: 'copy', label: 'Copy', shortcut: 'Mod+C' },
        { id: 'arrange', label: 'Arrange', shortcut: 'Mod+]' },
        { id: 'delete', label: 'Delete', shortcut: 'Backspace' },
        { id: 'next', label: 'Next', shortcut: 'Shift+N' },
        { id: 'web', label: 'Web only', shortcut: 'Mod+J', target: 'browser' },
        { type: 'separator' },
        {
          id: 'more',
          label: 'More',
          sub: [
            { id: 'align', label: 'Align', shortcut: 'Alt+A' },
            { id: 'group', label: 'Group', command: 'selection.group' }
          ]
        }
      ]
    },
    {
      label: 'Debug',
      target: 'browser',
      items: [{ id: 'tools', label: 'Tools', shortcut: 'Mod+K' }]
    }
  ]

  test('collects the items of every native menu, nested ones included', () => {
    const group = editorCommandMetadata('selection.group', 'linux').shortcut
    expect(group).toBeDefined()
    expect(menuShortcuts(groups, 'linux')).toEqual(compact(['Mod+]', 'Alt+A', group]))
  })

  test('leaves field edits in the app menu to the field', () => {
    const edits = compact(
      ['edit.undo', 'edit.redo', 'selection.selectAll', 'copy', 'cut', 'paste'].map(appMenuShortcut)
    )
    expect(edits).toHaveLength(6)
    expect(appMenuShortcuts('linux').filter((shortcut) => edits.includes(shortcut))).toEqual([])
  })

  test('drops editor bindings whose key the menu takes', () => {
    const run = () => true
    const bindings: KeyBinding[] = [
      { key: 'Mod-]', run },
      { key: 'Shift-Mod-k', run },
      { key: 'Mod-Shift-K', run },
      { key: 'Mod-z', run },
      { key: 'Tab', run },
      { key: 'Alt-ArrowUp', run },
      { mac: 'Cmd-]', run }
    ]
    const keys = (platform: 'mac' | 'linux') =>
      withoutMenuKeys(bindings, ['Mod+]', 'Mod+Shift+K'], platform).map(
        (binding) => binding.key ?? binding.mac
      )
    expect(keys('linux')).toEqual(['Mod-z', 'Tab', 'Alt-ArrowUp', 'Cmd-]'])
    expect(keys('mac')).toEqual(['Mod-z', 'Tab', 'Alt-ArrowUp'])
  })

  test('reads an uppercase letter as Shift, as CodeMirror does', () => {
    const run = () => true
    expect(withoutMenuKeys([{ key: 'Alt-A', run }], ['Alt+A'], 'linux')).toHaveLength(1)
    expect(withoutMenuKeys([{ key: 'Alt-A', run }], ['Alt+Shift+A'], 'linux')).toHaveLength(0)
  })

  test('keeps a Ctrl binding where the menu takes Cmd', () => {
    const run = () => true
    expect(withoutMenuKeys([{ key: 'Ctrl-]', run }], ['Mod+]'], 'mac')).toHaveLength(1)
    expect(withoutMenuKeys([{ key: 'Ctrl-]', run }], ['Mod+]'], 'windows')).toHaveLength(0)
  })
})
