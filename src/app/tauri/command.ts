/**
 * Resolve a CLI invocation into the form the Tauri process spawner can launch
 * on the current platform.
 *
 * On Windows, npm-installed global CLIs (e.g. `claude-agent-acp`,
 * `openpencil-mcp-http`) are `.cmd` shims. The Rust spawner behind
 * `@tauri-apps/plugin-shell` only resolves real executables, so launching a
 * `.cmd` directly fails with ENOENT. Routing through `cmd /c` lets the shell
 * resolve the shim via PATHEXT. `cmd` is allowlisted in
 * desktop/capabilities/default.json.
 *
 * The `userAgent` argument is injectable for testing; it defaults to the live
 * navigator value at runtime, falling back to an empty string in non-browser
 * contexts (e.g. headless tests) where `navigator` is unavailable.
 */
function detectUserAgent(): string {
  const ua = typeof navigator === 'undefined' ? undefined : navigator.userAgent
  return typeof ua === 'string' ? ua : ''
}

export function resolvePlatformCommand(
  command: string,
  args: string[] = [],
  userAgent: string = detectUserAgent()
): { command: string; args: string[] } {
  if (userAgent.includes('Windows')) {
    return { command: 'cmd', args: ['/c', command, ...args] }
  }
  return { command, args }
}
