import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import '@/app.css'
import { recordRuntimeError } from '@/app/diagnostics'

import PresenterView from '@/views/PresenterView.vue'

// Entry for the presenter's window (`pages/presenter.html`). It never boots the editor: the window
// presenting the deck tells it where the presentation is over a BroadcastChannel.
const app = createApp(PresenterView)
app.config.errorHandler = (error, _instance, info) => {
  recordRuntimeError(error, 'vue', info)
  console.error(error)
}
app.use(createHead()).mount('#app')
