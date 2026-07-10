import { ref } from 'vue'

/** Open state of the global Settings dialog — shared so any screen can deep-link into it. */
export const settingsDialogOpen = ref(false)
