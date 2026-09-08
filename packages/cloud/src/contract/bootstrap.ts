import { parseCloudDiscovery, type CloudDiscovery } from './discovery'

export const CLOUD_BOOTSTRAP_ID = 'openpencil-cloud-bootstrap'

export function serializeCloudBootstrap(discovery: CloudDiscovery): string {
  return JSON.stringify(discovery)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

export function injectCloudBootstrap(html: string, discovery: CloudDiscovery): string {
  const marker = `<script id="${CLOUD_BOOTSTRAP_ID}" type="application/json"></script>`
  if (!html.includes(marker)) throw new Error('Cloud admin HTML is missing its bootstrap marker')
  return html.replace(
    marker,
    `<script id="${CLOUD_BOOTSTRAP_ID}" type="application/json">${serializeCloudBootstrap(discovery)}</script>`
  )
}

export function parseCloudBootstrap(source: string): CloudDiscovery {
  return parseCloudDiscovery(JSON.parse(source))
}
