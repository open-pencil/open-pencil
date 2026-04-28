import { EditableArea, EditableInput, EditablePreview, EditableRoot } from 'reka-ui'
import { h, type Component, type ComputedRef } from 'vue'

import type { Variable, VariableValue } from '@open-pencil/core/scene-graph'
import type { Color } from '@open-pencil/core/types'
import type { ColumnDef } from '@tanstack/vue-table'

export interface VariablesTableOptions {
  activeModes: ComputedRef<{ modeId: string; name: string }[]>
  formatModeValue: (variable: Variable, modeId: string) => string
  parseVariableValue: (variable: Variable, raw: string) => VariableValue | undefined
  shortName: (variable: Variable) => string
  renameVariable: (id: string, newName: string) => void
  updateVariableValue: (id: string, modeId: string, value: VariableValue) => void
  removeVariable: (id: string) => void
  ColorInput: Component
  icons: Record<string, Component>
  fallbackIcon: Component
  deleteIcon: Component
}

function commitNameEdit(options: VariablesTableOptions, variable: Variable, newName: string) {
  if (newName && newName !== variable.name) {
    options.renameVariable(variable.id, newName)
  }
}

function commitValueEdit(
  options: VariablesTableOptions,
  variable: Variable,
  modeId: string,
  newValue: string
) {
  const parsed = options.parseVariableValue(variable, newValue)
  if (parsed !== undefined) {
    options.updateVariableValue(variable.id, modeId, parsed)
  }
}

function createVariableNameColumn(options: VariablesTableOptions): ColumnDef<Variable> {
  return {
    id: 'name',
    header: 'Name',
    size: 200,
    minSize: 120,
    maxSize: 400,
    cell: ({ row }) => {
      const variable = row.original
      const iconClass = 'size-3.5 shrink-0 text-muted'
      const iconComponent = options.icons[variable.type] ?? options.fallbackIcon
      const icon = h(iconComponent, { class: iconClass })

      return h('div', { class: 'flex items-center gap-2' }, [
        icon,
        h(
          EditableRoot,
          {
            defaultValue: options.shortName(variable),
            class: 'min-w-0 flex-1',
            onSubmit: (value: string | null | undefined) =>
              value && commitNameEdit(options, variable, value)
          },
          () =>
            h(EditableArea, { class: 'flex' }, () => [
              h(EditablePreview, {
                class: 'min-w-0 flex-1 cursor-text truncate text-xs text-surface'
              }),
              h(EditableInput, {
                class:
                  'min-w-0 flex-1 rounded border border-border bg-surface/10 px-1 py-0.5 text-xs text-surface outline-none'
              })
            ])
        )
      ])
    }
  }
}

function createVariableModeColumns(options: VariablesTableOptions): ColumnDef<Variable>[] {
  return options.activeModes.value.map((mode) => ({
    id: `mode-${mode.modeId}`,
    header: mode.name,
    size: 200,
    minSize: 120,
    maxSize: 500,
    cell: ({ row }) => {
      const variable = row.original
      const value = variable.valuesByMode[mode.modeId]

      if (variable.type === 'COLOR' && value && typeof value === 'object' && 'r' in value) {
        return h(options.ColorInput, {
          color: value,
          onUpdate: (color: Color) => options.updateVariableValue(variable.id, mode.modeId, color)
        })
      }

      return h(
        EditableRoot,
        {
          defaultValue: options.formatModeValue(variable, mode.modeId),
          class: 'min-w-0 flex-1',
          onSubmit: (submitted: string | null | undefined) =>
            submitted && commitValueEdit(options, variable, mode.modeId, submitted)
        },
        () =>
          h(EditableArea, { class: 'flex' }, () => [
            h(EditablePreview, {
              class: 'min-w-0 flex-1 cursor-text truncate font-mono text-xs text-muted'
            }),
            h(EditableInput, {
              class:
                'min-w-0 flex-1 rounded border border-border bg-surface/10 px-1 py-0.5 font-mono text-xs text-surface outline-none'
            })
          ])
      )
    }
  }))
}

function createDeleteColumn(options: VariablesTableOptions): ColumnDef<Variable> {
  return {
    id: 'actions',
    header: '',
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    cell: ({ row }) =>
      h(
        'button',
        {
          class:
            'flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface',
          onClick: () => options.removeVariable(row.original.id)
        },
        h(options.deleteIcon, { class: 'size-3' })
      )
  }
}

export function createVariableColumns(options: VariablesTableOptions): ColumnDef<Variable>[] {
  return [
    createVariableNameColumn(options),
    ...createVariableModeColumns(options),
    createDeleteColumn(options)
  ]
}
