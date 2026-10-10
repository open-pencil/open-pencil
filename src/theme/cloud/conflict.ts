import { tv } from 'tailwind-variants'

export const cloudConflict = tv({
  slots: {
    versions: 'grid grid-cols-2 gap-3',
    version: 'm-0 min-w-0',
    preview:
      'flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field',
    image: 'size-full object-cover',
    caption: 'mt-2 flex flex-col',
    versionLabel: 'text-xs font-medium text-surface',
    versionMeta: 'truncate text-[11px] text-muted',
    options: 'mt-4 flex flex-col gap-1.5',
    option:
      'group flex w-full items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent/50 data-[state=checked]:border-panel-focus data-[state=checked]:bg-panel-selected-muted data-[tone=danger]:data-[state=checked]:border-error-border data-[tone=danger]:data-[state=checked]:bg-error-bg',
    optionMark:
      'mt-0.5 size-3.5 shrink-0 rounded-full border border-muted/60 group-data-[state=checked]:border-4 group-data-[state=checked]:border-accent group-data-[tone=danger]:group-data-[state=checked]:border-error',
    optionLabel: 'block text-xs font-medium text-surface',
    optionDescription: 'mt-0.5 block text-[11px] leading-relaxed text-muted'
  }
})
