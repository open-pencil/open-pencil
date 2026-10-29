import { Hono } from 'hono'

import { PICTURE_PATH, type UserPictureService } from './service'

/**
 * Account pictures, for anyone with a picture's address: pages show people to those they share
 * documents and workspaces with, and the desktop app shows them from another origin.
 */
export function createPictureRoutes(pictures: UserPictureService) {
  return new Hono().get(`${PICTURE_PATH}/:userId/:version`, async (context) => {
    const picture = await pictures.read(context.req.param('userId'), context.req.param('version'))
    if (!picture) return context.json({ error: { code: 'not_found' as const } }, 404)
    // The address changes with the picture, but a removed one must stop showing within a day.
    context.header('Cache-Control', 'public, max-age=86400')
    context.header('Content-Type', `image/${picture.format}`)
    context.header('X-Content-Type-Options', 'nosniff')
    context.header('Content-Security-Policy', "default-src 'none'; sandbox")
    context.header('Cross-Origin-Resource-Policy', 'cross-origin')
    return context.body(new Uint8Array(picture.bytes))
  })
}
