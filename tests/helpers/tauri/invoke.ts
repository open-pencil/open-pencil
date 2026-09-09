import type { invoke } from '@tauri-apps/api/core'

type InvokeArguments = Parameters<typeof invoke>[1]

/** Invoke inside the built WebView; package imports cannot execute in serialized callbacks. */
export async function invokeNative<T>(command: string, args?: InvokeArguments): Promise<T> {
  return browser.execute(
    async (command, args) => {
      const core = window.__TAURI__?.core
      if (!core) throw new Error('Native test requires app.withGlobalTauri')
      return core.invoke<T>(command, args)
    },
    command,
    args
  )
}
