export function isTauri(): boolean {
  return 'window' in globalThis && '__TAURI_INTERNALS__' in globalThis.window
}
