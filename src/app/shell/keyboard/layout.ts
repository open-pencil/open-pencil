const LATIN_LETTER = /^[a-z]$/i

/**
 * The key code a shortcut matches: the letter a Latin layout types, so Cmd+Z follows the printed
 * Z on QWERTZ and AZERTY, or the physical key on layouts whose letter keys type no Latin letter,
 * such as Russian, where Cmd+Я is Cmd+Z.
 */
export function shortcutCode(event: Pick<KeyboardEvent, 'key' | 'code'>): string {
  return LATIN_LETTER.test(event.key) ? `Key${event.key.toUpperCase()}` : event.code
}

/** `event` with {@link shortcutCode} as its `code`, for tinykeys bindings written as key codes. */
export function shortcutEvent(event: KeyboardEvent): KeyboardEvent {
  const code = shortcutCode(event)
  if (code === event.code) return event
  return new Proxy(event, {
    get(target, property) {
      if (property === 'code') return code
      const value: unknown = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}
