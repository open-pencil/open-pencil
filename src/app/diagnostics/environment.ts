import { IS_TAURI } from '@/constants'

/** What a copied report needs to reproduce a problem: which build, shell, and browser. */
export function diagnosticsEnvironment() {
  return {
    app: typeof __OPENPENCIL_APP_VERSION__ === 'string' ? __OPENPENCIL_APP_VERSION__ : 'unknown',
    shell: IS_TAURI ? 'desktop' : 'browser',
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    language: typeof navigator === 'undefined' ? null : navigator.language,
    exportedAt: new Date().toISOString()
  }
}
