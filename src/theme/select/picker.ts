import { motionStyles } from '../motion/styles'
import { floatingSurface } from '../overlay'
import { panelFieldBase } from '../panel/field'

/** A searchable list of choices that opens beside the properties panel, as Figma's pickers do. */
const appPickerTheme = {
  slots: {
    content: [
      'z-[100] flex max-h-96 w-64 max-w-[calc(100vw-1rem)] flex-col overflow-hidden',
      floatingSurface,
      motionStyles.floating
    ],
    header: 'flex items-center gap-1.5 border-b border-border px-3 py-2',
    title: 'text-xs font-semibold text-surface',
    search: [panelFieldBase, 'relative m-2 flex h-7 shrink-0 items-center'],
    searchIcon: 'pointer-events-none absolute left-2 size-3.5 text-muted',
    input:
      'h-full min-w-0 flex-1 bg-transparent pr-2 pl-7 text-xs text-surface outline-none placeholder:text-muted',
    list: 'flex min-h-0 flex-col gap-2 overflow-y-auto px-2 pb-2',
    groupLabel: 'px-1 pb-1 text-[10px] font-medium tracking-wide text-muted uppercase',
    item: 'flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover',
    leading:
      'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-panel-secondary text-muted',
    text: 'min-w-0 flex-1',
    label: 'block truncate text-xs text-surface',
    description: 'block truncate text-[10px] text-muted',
    check: 'size-3 shrink-0 text-primary',
    empty: 'px-1 py-2 text-[11px] text-muted',
    footer: 'border-t border-border p-1'
  },
  variants: {
    density: {
      /** One line per choice, for plain names such as variables or styles. */
      compact: { leading: 'size-5 border-0 bg-transparent', item: 'min-h-7' },
      /** A thumbnail and a description line, for components and assets. */
      comfortable: {}
    }
  },
  defaultVariants: { density: 'comfortable' as const }
}

export type AppPickerTheme = typeof appPickerTheme
export default appPickerTheme
