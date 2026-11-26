import { focusStyles } from '@open-pencil/theme'

/**
 * A coding agent's controls in the composer: its mode, its model with the thinking level, and
 * widened access. Every control in the row looks the same, muted text with a hover fill; state
 * shows as brightness and a word, and colour is kept for widened access. Composers narrower than
 * 16rem fold the model control to its thinking level and access to its warning icon.
 */
export default {
  slots: {
    control: [
      'flex h-6 min-w-0 shrink-0 items-center gap-1 rounded border-none bg-transparent px-1.5 text-3xs text-muted hover:bg-hover hover:text-surface data-[state=open]:bg-hover',
      focusStyles.ring
    ],
    /** The model control gives way first: its name shortens before anything leaves the row. */
    modelControl: [
      'flex h-6 min-w-0 shrink items-center gap-1 overflow-hidden rounded border-none bg-transparent px-1.5 text-3xs text-muted hover:bg-hover hover:text-surface data-[state=open]:bg-hover',
      focusStyles.ring
    ],
    /** The mode's name, cut short before it crowds the model control. */
    value: 'max-w-24 truncate',
    chevron: 'size-2.5 shrink-0',
    icon: 'size-3 shrink-0',
    /** The agent's icon beside its name; a narrow composer shows the thinking level alone. */
    modelIcon: 'hidden size-3 shrink-0 @[16rem]:block',
    /** The profile's name, which narrow composers leave to the menu. */
    model: 'hidden min-w-0 truncate @[16rem]:inline',
    /** The thinking level after the name, set apart by a dot when the name shows. */
    level: 'shrink-0 @[16rem]:before:me-1 @[16rem]:before:content-["·"]',
    /** Widened access: its words when there is room, its warning icon always. */
    accessIcon: 'size-3 shrink-0 text-warning',
    accessLabel: 'hidden max-w-24 truncate @[16rem]:inline',
    modeContent: 'w-64 max-w-[calc(100vw-1rem)]',
    description: 'block text-4xs text-muted whitespace-normal',
    menuValue: 'ms-auto text-2xs text-muted',
    menuIndicator: 'flex size-3.5 shrink-0 items-center justify-center text-primary'
  },
  variants: {
    changed: {
      true: { control: 'text-surface' }
    },
    /** Without a level to show the name stays at every width, as the model control's only word; the icon still waits for room. */
    levelless: {
      true: { model: 'inline' }
    }
  }
} as const
