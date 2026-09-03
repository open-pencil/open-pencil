import { VueQueryPlugin } from '@tanstack/vue-query'
import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import App from './App.vue'
import { queryClient } from './app/query/client'
import { router } from './app/router'

import './app.css'

createApp(App).use(createHead()).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
