import { resolve } from 'node:path'
import process from 'node:process'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'

import { ensureBrandAssets } from '@open-pencil/brand-tools'
import { ensureDemoDocument } from '@open-pencil/demo-tools'

import packageJson from './package.json'
import { viteBuildTarget } from './src/app/shell/support/baseline'
import { createOpenPencilAliases } from './vite/aliases'
import {
  localAutomationRoute,
  localAutomationToken,
  openPencilAutomationPlugin
} from './vite/automation'
import { bootSplashPlugin } from './vite/boot-splash'
import { cloudSitePlugin } from './vite/cloud-site'
import { aiIconCollection } from './vite/icons'
import { inlineScriptPlugin } from './vite/inline-script'
import { metricsBrandPlugin } from './vite/metrics'
import { openPencilPwaPlugin } from './vite/pwa'
import { rawMarkdownPlugin } from './vite/raw-markdown'
import { createDevServerOptions } from './vite/server'

const host = process.env.TAURI_DEV_HOST
const automationRoute = localAutomationRoute(host)

export default defineConfig(async ({ command, mode }) => {
  // `--mode cloud` builds what a Cloud server serves on its own address: the editor and the
  // server's own pages (`cloud.html`).
  const cloudSite = mode === 'cloud'
  // `--mode metrics` builds only the metrics dashboard (`metrics.html`) for the feedback Worker,
  // which serves it under /admin behind Cloudflare Access.
  const metrics = mode === 'metrics'
  const env = loadEnv(mode, __dirname, 'VITE_')
  // `VITE_OPENPENCIL_CLOUD=off` builds the editor without OpenPencil Cloud.
  const cloud = env.VITE_OPENPENCIL_CLOUD !== 'off'
  // Agents automate the editor's own development server; a Cloud site, built or served, has none.
  const automation = !metrics && !cloudSite
  await Promise.all([ensureBrandAssets(['web']), metrics ? undefined : ensureDemoDocument()])
  return {
    resolve: {
      alias: createOpenPencilAliases(__dirname, { cloud })
    },
    define: {
      __OPENPENCIL_APP_VERSION__: JSON.stringify(packageJson.version),
      __OPENPENCIL_CLOUD_SITE__: JSON.stringify(cloudSite),
      __OPENPENCIL_OFFICIAL_CLOUD_URL__: JSON.stringify(
        env.VITE_OPENPENCIL_OFFICIAL_CLOUD_URL ?? null
      ),
      __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__: JSON.stringify(
        automation ? localAutomationToken(command) : null
      ),
      __OPENPENCIL_LOCAL_AUTOMATION_URL__: JSON.stringify(automationRoute.browserURL),
      __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__: JSON.stringify(
        automationRoute.browserURL.replace(/^ws/, 'http')
      )
    },
    // Dynamic browser fixtures must not trigger a dependency-optimizer reload mid-test.
    optimizeDeps: { include: ['ai/test'] },
    plugins: [
      rawMarkdownPlugin(),
      inlineScriptPlugin(),
      bootSplashPlugin({
        entry: resolve(__dirname, 'src/splash/theme.ts'),
        pages: ['index.html', 'cloud.html', 'metrics.html']
      }),
      tailwindcss(),
      Icons({ compiler: 'vue3', customCollections: { ai: aiIconCollection() } }),
      Components({ resolvers: [IconsResolver({ prefix: 'icon', customCollections: ['ai'] })] }),
      automation ? openPencilAutomationPlugin(command, host) : undefined,
      vue(),
      metrics ? metricsBrandPlugin((outDir) => resolve(outDir, '..')) : openPencilPwaPlugin(),
      cloudSite ? cloudSitePlugin() : undefined
    ],
    clearScreen: false,
    // A Cloud server routes its own pages and falls back to the editor itself, so a development
    // server it takes files from answers only the files it has. Its dependency cache is its own,
    // so it runs beside the editor's development server in the same checkout.
    appType: cloudSite ? 'mpa' : 'spa',
    cacheDir: cloudSite ? 'node_modules/.vite-cloud' : undefined,
    publicDir: metrics ? false : 'public',
    base: metrics ? '/admin/' : '/',
    build: {
      // Syntax is lowered to the supported browser baseline; APIs are not polyfilled.
      target: viteBuildTarget(),
      chunkSizeWarningLimit: 2500,
      outDir: metrics ? 'dist-metrics/admin' : cloudSite ? 'dist-cloud' : 'dist',
      rolldownOptions: {
        // The desktop Software Update window is its own page; a Cloud server adds its own
        // pages beside the editor, and the metrics dashboard builds alone.
        input: metrics
          ? { metrics: resolve(__dirname, 'metrics.html') }
          : cloudSite
            ? { main: resolve(__dirname, 'index.html'), cloud: resolve(__dirname, 'cloud.html') }
            : {
                main: resolve(__dirname, 'index.html'),
                updater: resolve(__dirname, 'updater.html')
              }
      }
    },
    server: createDevServerOptions(
      host,
      __dirname,
      cloudSite ? process.env.PORTLESS_URL : undefined
    )
  }
})
