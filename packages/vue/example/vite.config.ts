import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { openPencil } from '@open-pencil/core/node/vite'

export default defineConfig({
  plugins: [vue(), openPencil()],
  server: {
    port: 3333
  }
})
