/**
 * Whether the MCP integrations section is exposed in Settings.
 *
 * MCP servers are spawned as local child processes through tauri-plugin-shell,
 * which has no meaningful implementation on Android. The section is therefore
 * hidden on mobile, where it would only be able to list unusable entries.
 *
 * The underlying MCP code is untouched — only the Settings entry is gated.
 * Set to `true` to bring it back unconditionally.
 */
import { isAndroid } from '@/app/tauri/env'

export const MCP_SETTINGS_ENABLED = !isAndroid()
