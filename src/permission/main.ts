import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import '@/app.css'
import { recordRuntimeError } from '@/app/diagnostics'
import PermissionView from '@/views/PermissionView.vue'

// Entry for the desktop permission window (`pages/permission.html`), which only the desktop app opens
// and which alone answers agents' permission requests. It never boots the editor.
const app = createApp(PermissionView)
app.config.errorHandler = (error, _instance, info) => {
  recordRuntimeError(error, 'vue', info)
  console.error(error)
}
app.use(createHead()).mount('#app')
