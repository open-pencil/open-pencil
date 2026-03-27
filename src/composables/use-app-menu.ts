import { computed } from 'vue'

import { openFileDialog } from '@/composables/use-menu'
import { useEditorStore } from '@/stores/editor'
import { useEditorCommands, useI18n } from '@open-pencil/vue'

import type { MenuEntry } from '@open-pencil/vue'

export interface AppMenuGroup {
  label: string
  items: MenuEntry[]
}

export function useAppMenu(mod: string) {
  const store = useEditorStore()
  const { menuItem: commandMenuItem } = useEditorCommands()
  const { menu: t, panels: p, locale, availableLocales, localeLabels, setLocale } = useI18n()

  const languageMenu = computed<MenuEntry[]>(() =>
    availableLocales.map((code) => ({
      label: localeLabels[code],
      checked: locale.value === code,
      onCheckedChange: (checked: boolean) => {
        if (checked) setLocale(code)
      }
    }))
  )

  const topMenus = computed<AppMenuGroup[]>(() => [
    {
      label: t.value.file,
      items: [
        {
          label: t.value.new,
          shortcut: `${mod}N`,
          action: () => {
            void import('@/stores/tabs').then((m) => m.createTab())
          }
        },
        { label: t.value.open, shortcut: `${mod}O`, action: () => void openFileDialog() },
        { separator: true as const },
        { label: t.value.save, shortcut: `${mod}S`, action: () => void store.saveFigFile() },
        {
          label: t.value.saveAs,
          shortcut: `${mod}⇧S`,
          action: () => void store.saveFigFileAs()
        },
        { separator: true as const },
        {
          label: t.value.exportSelection,
          shortcut: `${mod}⇧E`,
          sub: [
            {
              label: 'PNG',
              action: () => {
                void store.exportSelection(1, 'png')
              }
            },
            {
              label: 'SVG',
              action: () => {
                void store.exportSelection(1, 'svg')
              }
            },
            {
              label: '.fig',
              action: () => {
                void store.exportSelection(1, 'fig')
              }
            }
          ]
        },
        { separator: true as const },
        {
          label: t.value.autosave,
          get checked() {
            return store.state.autosaveEnabled
          },
          onCheckedChange: (value: boolean) => {
            store.state.autosaveEnabled = value
          }
        }
      ]
    },
    {
      label: t.value.edit,
      items: [
        commandMenuItem('edit.undo', `${mod}Z`),
        commandMenuItem('edit.redo', `${mod}⇧Z`),
        { separator: true as const },
        { label: t.value.copy, shortcut: `${mod}C` },
        { label: t.value.paste, shortcut: `${mod}V` },
        commandMenuItem('selection.duplicate', `${mod}D`),
        commandMenuItem('selection.delete', '⌫'),
        { separator: true as const },
        commandMenuItem('selection.selectAll', `${mod}A`)
      ]
    },
    {
      label: t.value.view,
      items: [
        commandMenuItem('view.zoom100', `${mod}0`),
        commandMenuItem('view.zoomFit', `${mod}1`),
        commandMenuItem('view.zoomSelection', `${mod}2`),
        {
          label: t.value.zoomIn,
          shortcut: `${mod}=`,
          action: () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2)
        },
        {
          label: t.value.zoomOut,
          shortcut: `${mod}-`,
          action: () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2)
        },
        { separator: true as const },
        {
          label: t.value.profiler,
          get checked() {
            return store.renderer?.profiler.hudVisible ?? false
          },
          onCheckedChange: () => {
            store.toggleProfiler()
          }
        },
        { separator: true as const },
        {
          label: t.value.language,
          sub: languageMenu.value
        }
      ]
    },
    {
      label: t.value.object,
      items: [
        commandMenuItem('selection.group', `${mod}G`),
        commandMenuItem('selection.ungroup', `${mod}⇧G`),
        { separator: true as const },
        commandMenuItem('selection.createComponent', `${mod}⌥K`),
        commandMenuItem('selection.createComponentSet'),
        commandMenuItem('selection.detachInstance'),
        { separator: true as const },
        commandMenuItem('selection.bringToFront', ']'),
        commandMenuItem('selection.sendToBack', '[')
      ]
    },
    {
      label: t.value.arrange,
      items: [
        commandMenuItem('selection.wrapInAutoLayout', '⇧A'),
        { separator: true as const },
        { label: p.value.alignLeft, shortcut: '⌥A' },
        { label: p.value.alignCenter, shortcut: '⌥H' },
        { label: p.value.alignRight, shortcut: '⌥D' },
        { separator: true as const },
        { label: p.value.alignTop, shortcut: '⌥W' },
        { label: p.value.alignMiddle, shortcut: '⌥V' },
        { label: p.value.alignBottom, shortcut: '⌥S' }
      ]
    },
    {
      label: t.value.text,
      items: [
        { label: t.value.bold, shortcut: `${mod}B` },
        { label: t.value.italic, shortcut: `${mod}I` },
        { label: t.value.underline, shortcut: `${mod}U` }
      ]
    }
  ])

  return { topMenus }
}
