<script setup lang="ts">
export type SdkDataTableColumn = {
  key: string
  label: string
  kind?: 'code' | 'chip' | 'text' | 'description'
}

export type SdkDataTableRow = Record<string, string | boolean | undefined>

defineProps<{
  columns: SdkDataTableColumn[]
  rows: SdkDataTableRow[]
  rowKey?: string
}>()

function cellValue(row: SdkDataTableRow, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function isRequired(row: SdkDataTableRow) {
  return row.required === true
}
</script>

<template>
  <div class="sdk-table-wrap">
    <table class="sdk-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="cellValue(row, rowKey ?? 'name')">
          <td v-for="column in columns" :key="column.key">
            <template v-if="column.kind === 'code'">
              <code class="sdk-table__code">
                {{ cellValue(row, column.key) }}<span v-if="column.key === 'name' && isRequired(row)">*</span>
              </code>
              <div v-if="row.description" class="sdk-table__description">
                {{ row.description }}
              </div>
            </template>
            <template v-else-if="column.kind === 'chip'">
              <code v-if="cellValue(row, column.key)" class="sdk-table__chip">
                {{ cellValue(row, column.key) }}
              </code>
              <span v-else>—</span>
            </template>
            <template v-else-if="column.kind === 'description'">
              <span class="sdk-table__description-cell">{{ cellValue(row, column.key) }}</span>
            </template>
            <template v-else>
              {{ cellValue(row, column.key) || '—' }}
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sdk-table-wrap {
  overflow-x: auto;
}

.sdk-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.sdk-table th,
.sdk-table td {
  padding: 16px;
  vertical-align: top;
  border: 1px solid var(--vp-c-divider);
}

.sdk-table thead th {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-weight: 600;
  text-align: left;
}

.sdk-table thead th:first-child {
  border-top-left-radius: 14px;
}

.sdk-table thead th:last-child {
  border-top-right-radius: 14px;
}

.sdk-table__code {
  color: var(--vp-c-brand-1);
}

.sdk-table__chip {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.sdk-table__description {
  margin-top: 8px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.sdk-table__description-cell {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
</style>
