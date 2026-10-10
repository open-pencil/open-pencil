export function inputValue(e: Event): string {
  return e.target instanceof HTMLInputElement ? e.target.value : ''
}

export function inputChecked(e: Event): boolean {
  return e.target instanceof HTMLInputElement && e.target.checked
}

export function inputNumberValue(e: Event): number {
  return +inputValue(e)
}

export function blurTarget(e: Event) {
  if (e.target instanceof HTMLElement) e.target.blur()
}

export function selectTarget(e: Event) {
  if (e.target instanceof HTMLInputElement) e.target.select()
}
