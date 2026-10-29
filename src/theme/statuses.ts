/**
 * The Statuses dialog's rows: a drag handle, the color, the name, and delete, on one grid so the
 * new-status field and each row's hint line up with the names.
 */
export default {
  slots: {
    row: 'grid grid-cols-[0.875rem_1.5rem_minmax(0,1fr)_1.5rem] items-center gap-x-1.5 gap-y-1',
    handle: 'size-3.5 cursor-grab text-muted',
    marker: 'flex size-6 items-center justify-center text-muted',
    hint: 'col-start-3 text-[11px] text-muted',
    field: 'col-start-3'
  }
} as const
