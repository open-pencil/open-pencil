import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { createOpenPencilAliases } from './vite/aliases'
import { localAutomationToken, openPencilAutomationPlugin } from './vite/automation'
import { copyCanvasKitAssetsPlugin } from './vite/canvaskit-assets'
import { openPencilPwaPlugin } from './vite/pwa'
import { rawMarkdownPlugin } from './vite/raw-markdown'
import { createDevServerOptions } from './vite/server'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

export default defineConfig(async ({ command }) => ({
  resolve: {
    alias: createOpenPencilAliases(__dirname)
  },
  define: {
    __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__: JSON.stringify(localAutomationToken(command))
  },
  plugins: [
    rawMarkdownPlugin(),
    copyCanvasKitAssetsPlugin(),
    tailwindcss(),
    Icons({ compiler: 'vue3' }),
    Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
    openPencilAutomationPlugin(command, host),
    vue(),
    openPencilPwaPlugin()
  ],
  clearScreen: false,
  server: createDevServerOptions(host)
}))
