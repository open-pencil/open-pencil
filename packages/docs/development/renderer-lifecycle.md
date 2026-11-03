# Renderer lifecycle and ownership

The CanvasKit renderer keeps hot drawing loops direct, but its tiled path follows explicit lifecycle contracts. Preserve these contracts when changing renderer structure or cache policy.

## Navigation and settlement

The scene layer renders through tiles; only a canvas that owns the whole frame, such as a thumbnail or an export, draws the scene as one picture. Tiles render at the exact device scale and are presented on whole device pixels, so a settled view is never resampled. It presents cached tiles whether or not navigation is active, covers a missing tile with the cached tiles of the nearest level scaled into place, and leaves areas no level covers at the page colour until their tiles render; it never draws the whole-scene picture, which a large document cannot afford. Panning keeps rasterizing under a smaller frame budget and runs at most one tile estimated past it; a zoom whose level moves renders, under that budget, the quantized step at or above the scale, whose tiles serve until the zoom crosses the next step and then stand in for the exact level scaled by a fifth at most, over the pyramid, the page copy, and the earlier levels; a zoom that pauses renders the exact level under the moving budget; a level is presented only once every visible tile of it exists, the nearest level standing in whole until then, or the page colour when the page is first shown, so a zoom or a page open ends with the viewport appearing in one frame, while a level once presented shows the tiles a pan reveals or an edit renews as they land; the background stages wait until the content has been still for 300 ms, so an edit in progress rebuilds the visible tiles alone and the coarse copies under it once it pauses; a tile whose chunk pictures are not all recorded records them until the frame's budget is spent and defers the rest; queued jobs for another level or an earlier navigation generation are discarded. Idle time builds, in order, the whole page at a level where it spans four tiles, the overscan ring, a pyramid of levels each downsampled from the four cached tiles twice as fine, and a scene-rendered backdrop four times coarser around the viewport, so a hole anywhere over the page finds a scaled stand-in; a missing tile draws the nearest level that covers its overlap with the page fully, found past any partial levels, with up to two nearer partial levels layered on top; the page copy is kept most recently used, so it is evicted last. A tile not rendered yet is estimated from its chunk count at the per-chunk time measured for its level, or for any level until its own is known. The tile cache's byte budget follows the viewport, five viewports of tiles between 128 MB and 768 MB, and a frame of background work that evicts a tile of its own plan's levels stops the background stages until the level or the viewport changes, so a cache too small for the plan holds what it has rather than rendering in circles. A layer added, removed, moved, or changed in kind rebuilds only the chunks of the smallest subtree that held it, slotted into the draw order between their neighbours, and drops the pictures and tiles those chunks touched; the page's own children added, removed, or reordered renumber the draw order of all chunks, and only a document loaded or replaced rebuilds the index from nothing. The controller reports background work separately from visible work: settlement waits only for the visible tiles, while the frame loop keeps idle frames coming until the background stages are built. A tile over nothing holds no texture. Fonts arriving redraw only the text that waited for them. Visible exact coverage while idle is the settlement boundary; overscan remains background work.

Generation rules:

- Navigation generations cancel obsolete queued tile work.
- Content generations invalidate affected pictures and tiles.
- Page, scene, position-preview, and font versions all participate in picture and tile validity.
- A stale build or raster result must be deleted rather than installed.

## CanvasKit ownership

CanvasKit objects are native/WASM resources and are not reclaimed reliably by JavaScript garbage collection. Ownership transfer must remain explicit.

| Resource | Created by | Owner after success | Released by |
| --- | --- | --- | --- |
| Whole-scene picture | Scene recorder | `wholeScene` | Replacement, invalidation, renderer destruction |
| Node picture | Node picture recorder | `nodePictures` | Node invalidation, font generation change, renderer destruction |
| Chunk picture | Chunk recorder | `RenderChunkPictureCache` | Chunk invalidation or cache clear |
| Tile image | `renderTile()` | Caller until installation, then `TileImageCache` | Stale-result discard, replacement, eviction, cache clear |
| Tile surface | `TileSurfacePool` | Surface pool | Pool clear |
| CanvasKit path arrays | Geometry builder | Owning geometry cache | Node invalidation or renderer destruction |

Do not introduce generic disposal wrappers into per-node or per-tile hot loops. Prefer narrow domain operations with obvious transfer points, and use `try/finally` around recorder, surface, paint-effect, and transform lifetimes.

## Performance-preserving refactors

Safe structural refactors may split modules, name state records, extract telemetry, and document transitions. They must not change:

- Frame budgets, cache limits, tile size, quantized levels, or overscan policy.
- Visible-before-overscan priority.
- Direct CanvasKit calls and preallocated temporary buffers in hot loops.
- Atomic isolation for masks, opacity, blend modes, and blur scopes.
- Exact settlement acknowledgement.

Validate structural changes with the `gold-preview.fig` reversal and mutation-plus-reversal benchmarks, focused renderer tests, and committed canvas snapshots. Compare production builds rather than relying on synchronous microbenchmarks.
