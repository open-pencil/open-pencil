/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="unplugin-icons/types/vue" />

interface ImportMetaEnv {
  /** `on` only in official release builds; without it the app sends no pings or usage stats. */
  readonly VITE_OPENPENCIL_FEEDBACK?: string
  /** Storage address a self-hosted build fills in; used only together with the bucket. */
  readonly VITE_STORAGE_PRESET_ENDPOINT?: string
  /** Storage bucket a self-hosted build fills in; used only together with the endpoint. */
  readonly VITE_STORAGE_PRESET_BUCKET?: string
}

declare const __OPENPENCIL_APP_VERSION__: string
declare const __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__: string | null
declare const __OPENPENCIL_LOCAL_AUTOMATION_URL__: string
declare const __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
