import { userEvent, within } from 'storybook/test'

/** The file header a Cloud status sits in, around the given status markup. */
export function statusToolbarTemplate(status: string, height: 'h-60' | 'h-80') {
  return `
      <div class="${height}">
        <div class="flex w-64 items-center gap-1 border-b border-border bg-panel px-2 py-2">
          <span class="flex size-6 items-center justify-center rounded bg-accent text-2xs font-bold text-on-accent">P</span>
          <span class="min-w-0 flex-1 truncate px-1 text-xs text-surface">Homepage redesign</span>
          ${status}
        </div>
      </div>`
}

/** Opens the status popover, as a click on the status does. */
export async function openStatusPopover({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>('[data-state-sync]')
  if (trigger) await userEvent.click(trigger)
  await within(document.body).findByRole('dialog')
}
