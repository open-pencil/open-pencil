import { buildComponent, createElement, resolveToTree } from '@open-pencil/core/design-jsx'

export function preprocessRpc(body: Record<string, unknown>): Record<string, unknown> {
  if (body.command !== 'tool') return body
  const args = body.args as { name?: string; args?: Record<string, unknown> } | undefined
  if (args?.name !== 'render' || !args.args?.jsx) return body
  try {
    const Component = buildComponent(args.args.jsx as string)
    const element = createElement(Component, null)
    const tree = resolveToTree(element)
    return {
      ...body,
      args: { ...args, args: { ...args.args, jsx: undefined, tree } },
    }
  } catch (e) {
    console.warn('JSX preprocessing failed, passing raw:', e instanceof Error ? e.message : e)
    return body
  }
}
