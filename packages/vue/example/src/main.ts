import canvasKitWasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url'
import { createApp } from 'vue'

import { setCanvasKitLocator } from '@open-pencil/core/canvaskit'

import App from './App.vue'

// Vite serves CanvasKit's binary from the package and emits it with the build.
setCanvasKitLocator(() => canvasKitWasm)

createApp(App).mount('#app')
