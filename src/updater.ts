import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { recordRuntimeError } from '@/app/diagnostics'

import UpdaterView from './views/UpdaterView.vue'

// Entry for the desktop Software Update window (`updater.html`). It never
// boots the editor; the main window has already passed the support gate.
const app = createApp(UpdaterView)
app.config.errorHandler = (error, _instance, info) => {
  recordRuntimeError(error, 'vue', info)
  console.error(error)
}
app.use(createHead()).mount('#app')
