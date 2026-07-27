import { raw, type NodeProxyInternals, type ProxyThis } from '#core/figma-api/accessor-utils'
import { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from '#core/io/formats/svg/paths'

export interface FigmaVectorPath {
  readonly windingRule: 'NONZERO' | 'EVENODD'
  readonly data: string
}

export function installVectorNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperty(prototype, 'vectorPaths', {
    get(this: ProxyThis): readonly FigmaVectorPath[] {
      const node = raw(this, internals)
      const paths =
        node.fillGeometry.length > 0
          ? node.fillGeometry.map((geometry) => ({
              windingRule: geometry.windingRule,
              data: geometryBlobToSVGPath(geometry.commandsBlob)
            }))
          : (node.vectorNetwork ? vectorNetworkToSVGPaths(node.vectorNetwork) : []).map((data) => ({
              windingRule: 'NONZERO' as const,
              data
            }))
      return Object.freeze(paths.map((path) => Object.freeze(path)))
    }
  })
}
