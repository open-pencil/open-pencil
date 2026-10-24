import type { CloudSignInMethod } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

/** Words for where a session or sign-in came from, and for how it signed in. */
export function usePortalDeviceLabels() {
  const messages = useCloudPortalMessages()
  function method(value: CloudSignInMethod): string {
    const words = messages.value
    const labels: Record<CloudSignInMethod, string> = {
      password: words.methodPassword,
      google: words.methodGoogle,
      apple: words.methodApple,
      passkey: words.methodPasskey,
      'two-step': words.methodTwoStep,
      'email-link': words.methodEmailLink,
      desktop: words.methodDesktop,
      other: words.methodOther
    }
    return labels[value]
  }
  /** The app, or the browser and system the server read, such as "Chrome 141 on macOS". */
  function device(value: {
    method: CloudSignInMethod | null
    browser: string | null
    system: string | null
  }): string {
    const words = messages.value
    if (value.method === 'desktop') return words.desktopApp
    if (value.browser && value.system) {
      return words.browserOn({ browser: value.browser, system: value.system })
    }
    return value.browser ?? value.system ?? words.unknownBrowser
  }
  return { method, device }
}
