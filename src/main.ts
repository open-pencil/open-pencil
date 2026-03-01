import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/engine/fonts'

import App from './App.vue'

preloadFonts()
createApp(App).mount('#app')
