import { focusStyles } from '@open-pencil/theme'

const slidesPanelTheme = {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col',
    header: 'flex shrink-0 items-center gap-1 px-3 py-1.5',
    title: 'min-w-0 flex-1 truncate text-2xs font-semibold text-surface',
    viewport: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2',
    empty: 'px-3 py-6 text-center text-2xs text-muted',
    section: 'flex flex-col border-border pb-1 not-first:border-t not-first:pt-1',
    row: [
      'relative flex w-full cursor-pointer items-start gap-2 rounded-lg p-1.5 text-start',
      focusStyles.ring
    ],
    number: 'w-4 shrink-0 pt-0.5 text-end text-3xs tabular-nums',
    disclosure: [
      'group absolute inset-s-0.5 top-1.5 flex size-4 items-center justify-center rounded text-muted hover:text-surface',
      focusStyles.ring
    ],
    disclosureIcon:
      'size-3 transition-transform motion-reduce:transition-none group-aria-expanded:rotate-90 rtl:group-aria-expanded:-rotate-90',
    frame:
      'relative min-w-0 flex-1 overflow-hidden rounded border border-border bg-white shadow-sm',
    image: 'block size-full',
    marks:
      'absolute inset-s-1 bottom-1 flex items-center gap-1 rounded bg-panel/90 p-0.5 text-surface empty:hidden',
    mark: 'size-3',
    dropIndicator: 'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent'
  },
  variants: {
    selected: {
      true: {
        row: 'bg-accent/15',
        number: 'text-surface',
        frame: 'border-accent ring-1 ring-accent'
      },
      false: { row: 'hover:bg-hover', number: 'text-muted' }
    },
    skipped: {
      true: { image: 'opacity-40' },
      false: {}
    },
    dragging: {
      true: { row: 'opacity-60' },
      false: {}
    },
    indented: {
      true: { row: 'ps-8' },
      false: { row: 'ps-5' }
    },
    dropPosition: {
      before: { dropIndicator: '-top-px' },
      after: { dropIndicator: '-bottom-px' }
    }
  },
  defaultVariants: { selected: false, skipped: false, dragging: false, indented: false }
}

export default slidesPanelTheme
