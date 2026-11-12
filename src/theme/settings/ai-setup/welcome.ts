export default {
  slots: {
    intro: 'rounded-lg border border-accent/25 bg-accent/5 p-4',
    heading: 'text-sm font-semibold text-surface',
    text: 'mt-2 text-xs leading-relaxed text-muted',
    // The button moves under the text when the section is too narrow for both on one line.
    tour: 'flex flex-wrap items-start justify-between gap-x-4 gap-y-3 rounded-lg border border-border p-4',
    tourText: 'min-w-0 flex-1 basis-48',
    tourAction: 'shrink-0'
  }
}
