import type { Component } from 'vue'

import type { Tool } from '@open-pencil/vue'

import type { ComponentUI } from '@/components/ui/types'
import type { ToolbarTheme } from '@/theme/toolbar'

export interface ToolbarActionItem {
  icon: Component
  label: string
  action: () => void
}

export type ToolbarUI = ComponentUI<ToolbarTheme>

export type ToolLabels = Record<Tool, string>
export type ToolIconMap = Record<Tool, Component>
