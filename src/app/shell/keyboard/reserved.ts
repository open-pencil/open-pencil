const RESERVED_MOD_CODES = new Set([
  'Backslash',
  'BracketLeft',
  'BracketRight',
  'Digit0',
  'Digit1',
  'Digit2',
  'KeyA',
  'KeyB',
  'KeyD',
  'KeyE',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyN',
  'KeyO',
  'KeyS',
  'KeyT',
  'KeyW',
  'KeyY',
  'KeyZ'
])

export function isReservedModShortcut(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false
  if (e.altKey) return e.code === 'KeyB' || e.code === 'KeyK'
  return RESERVED_MOD_CODES.has(e.code)
}

export function preventReservedKeyboardDefaults(e: KeyboardEvent) {
  if (isReservedModShortcut(e)) e.preventDefault()
  if (e.code === 'Backspace' || e.code === 'Delete') e.preventDefault()
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') e.preventDefault()
  if (e.code === 'Space') e.preventDefault()
}
