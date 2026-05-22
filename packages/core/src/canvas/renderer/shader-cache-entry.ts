import type { Shader } from 'canvaskit-wasm'

export class ShaderCacheEntry {
  constructor(
    public readonly signature: string,
    public readonly shader: Shader
  ) {}

  delete(): void {
    this.shader.delete()
  }
}
