import { EditableArea, EditableInput, EditablePreview, EditableRoot } from 'reka-ui'
import { computed, h, type Component } from 'vue'

import type { Color, Variable, VariableValue } from '@open-pencil/core'
import type { ColumnDef } from '@tanstack/vue-table'
import type { ComputedRef } from 'vue'

interface VariablesTableOptions {
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

export function useVariablesTable(options: VariablesTableOptions) {
  function commitNameEdit(variable: Variable, newName: string) {
    if (newName && newName !== variable.name) {
      options.renameVariable(variable.id, newName)
    }
  }

  function commitValueEdit(variable: Variable, modeId: string, newValue: string) {
    const parsed = options.parseVariableValue(variable, newValue)
    if (parsed !== undefined) {
      options.updateVariableValue(variable.id, modeId, parsed)
    }
  }

  const columns = computed<ColumnDef<Variable>[]>(() => {
    const nameCol: ColumnDef<Variable> = {
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
                value && commitNameEdit(variable, value)
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

    const modeCols: ColumnDef<Variable>[] = options.activeModes.value.map((mode) => ({
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
            color: value as Color,
            onUpdate: (color: Color) => options.updateVariableValue(variable.id, mode.modeId, color)
          })
        }

        return h(
          EditableRoot,
          {
            defaultValue: options.formatModeValue(variable, mode.modeId),
            class: 'min-w-0 flex-1',
            onSubmit: (value: string | null | undefined) =>
              value && commitValueEdit(variable, mode.modeId, value)
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

    const deleteCol: ColumnDef<Variable> = {
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

    return [nameCol, ...modeCols, deleteCol]
  })

  return {
    columns
  }
}
