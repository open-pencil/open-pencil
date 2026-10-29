import { computed, type Component } from 'vue'
import IconSmilePlus from '~icons/lucide/smile-plus'

import type { Tool } from '@open-pencil/core'
import { useI18n, usePanelMessages } from '@open-pencil/vue/i18n'

import type { ToolbarEntry } from '@/app/editor/toolbar/layout'
import { toolIcons } from '@/components/icons'

export function useToolLabels() {
  const { tools } = useI18n()
  return computed<Record<Tool, string>>(() => ({
    SELECT: tools.value.move,
    FRAME: tools.value.frame,
    SECTION: tools.value.section,
    RECTANGLE: tools.value.rectangle,
    ELLIPSE: tools.value.ellipse,
    LINE: tools.value.line,
    POLYGON: tools.value.polygon,
    STAR: tools.value.star,
    PEN: tools.value.pen,
    PENCIL: tools.value.pencil,
    TEXT: tools.value.text,
    STICKY: tools.value.sticky,
    SHAPE_WITH_TEXT: tools.value.shape,
    CONNECTOR: tools.value.connector,
    HAND: tools.value.hand,
    COMMENT: tools.value.comment
  }))
}

/** Names for everything the toolbar can show, tools and commands alike. */
export function useToolbarEntryLabels() {
  const toolLabels = useToolLabels()
  const panels = usePanelMessages()
  return computed<Record<ToolbarEntry, string>>(() => ({
    ...toolLabels.value,
    'insert-icon': panels.value.insertIcon
  }))
}

export const toolbarEntryIcons: Readonly<Record<ToolbarEntry, Component>> = {
  ...toolIcons,
  'insert-icon': IconSmilePlus
}
