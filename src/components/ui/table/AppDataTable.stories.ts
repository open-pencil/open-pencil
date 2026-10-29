import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/vue-table'
import { expect, within } from 'storybook/test'

import AppDataTable from './AppDataTable.vue'
import AppTablePagination from './AppTablePagination.vue'
import type { TableColumnMeta } from './columns'

type Layer = { id: string; name: string; kind: string; updated: string }

const features = tableFeatures({ columnMeta: {} as TableColumnMeta })
const column = createColumnHelper<typeof features, Layer>()
const columns = column.columns([
  column.accessor('name', { header: 'Name', meta: { class: 'font-medium' } }),
  column.accessor('kind', { header: 'Kind', meta: { class: 'w-28 text-muted' } }),
  column.accessor('updated', {
    header: 'Updated',
    meta: { class: 'hidden w-36 text-muted @xl/table:table-cell' }
  })
])
const layers: Layer[] = [
  { id: '1', name: 'Hero', kind: 'Frame', updated: 'Oct 24, 2026' },
  { id: '2', name: 'Primary button', kind: 'Component', updated: 'Oct 22, 2026' },
  { id: '3', name: 'Logo', kind: 'Vector', updated: 'Sep 30, 2026' }
]
const rowId = (layer: Layer) => layer.id

const meta = {
  title: 'Design System/Table/Data table',
  render: () => ({
    components: { AppDataTable, AppTablePagination },
    setup: () => ({ table: useTable({ features, columns, data: layers, getRowId: rowId }) }),
    template: `
      <div class="max-w-3xl p-4">
        <AppDataTable :table="table" label="Layers">
          <template #footer>
            <AppTablePagination range="1–3 of 3" :can-previous="false" :can-next="false" previous-label="Previous page" next-label="Next page" />
          </template>
        </AppDataTable>
      </div>`
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Rows: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.getByRole('table', { name: 'Layers' })).toBeVisible()
    await expect(page.getAllByRole('row')).toHaveLength(4)
  }
}

export const Loading: Story = {
  render: () => ({
    components: { AppDataTable },
    setup: () => ({ table: useTable({ features, columns, data: [] }) }),
    template: `
      <div class="max-w-3xl p-4">
        <AppDataTable :table="table" label="Layers" loading="first" />
      </div>`
  })
}

export const Empty: Story = {
  render: () => ({
    components: { AppDataTable },
    setup: () => ({ table: useTable({ features, columns, data: [] }) }),
    template: `
      <div class="max-w-3xl p-4">
        <AppDataTable :table="table" label="Layers">
          <template #empty><p class="text-center text-xs text-muted">No layers yet.</p></template>
        </AppDataTable>
      </div>`
  })
}
