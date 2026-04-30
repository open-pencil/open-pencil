export function isEditing(e: Event) {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
}

export function isInputElement(el: EventTarget | null | undefined): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}
