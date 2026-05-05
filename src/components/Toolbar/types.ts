import type { Component } from 'vue'

import type { Tool } from '@open-pencil/vue'

export interface ToolbarActionItem {
  icon: Component
  label: string
  action: () => void
}

export interface ToolbarUi {
  flyoutContent?: string
}

export type ToolLabels = Record<Tool, string>
export type ToolIconMap = Record<Tool, Component>
