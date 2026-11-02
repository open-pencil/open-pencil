/**
 * Public editor-context API for the Vue SDK: makes an editor available to a Vue subtree and
 * reads it back. Every other domain is a subpath named after its source folder.
 */
export { provideEditor, useEditor, EDITOR_KEY } from '#vue/editor/context'
