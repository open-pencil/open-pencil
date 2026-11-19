/**
 * Settings as the editor's Settings and the Cloud console lay them out: titled sections of
 * bordered groups, each row a label, its description, and its control at the end.
 */
export const settingsTheme = {
  slots: {
    section: 'flex flex-col gap-3',
    sectionHeader: 'flex items-start justify-between gap-4',
    sectionText: 'min-w-0 flex-1',
    sectionTitle: 'text-xs font-semibold text-surface',
    sectionDescription: 'mt-1 text-2xs text-muted',
    sectionActions: 'flex shrink-0 items-center gap-1',
    group: 'flex flex-col divide-y divide-border rounded border border-border',
    row: 'flex items-center justify-between gap-4 px-3 py-2.5',
    rowText: 'block min-w-0 flex-1',
    rowLabel: 'block text-xs font-medium text-surface',
    rowDescription: 'mt-1 block text-2xs leading-relaxed text-muted',
    rowControl: 'flex shrink-0 items-center gap-1'
  }
} as const
