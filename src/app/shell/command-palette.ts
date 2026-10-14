import { ref } from 'vue'

/** Whether the command palette is open: ⌘K and the main menu's Actions… both open it. */
export const commandPaletteOpen = ref(false)

export function openCommandPalette(): void {
  commandPaletteOpen.value = true
}
