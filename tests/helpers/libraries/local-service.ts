import 'fake-indexeddb/auto'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { LibraryService } from '@/app/libraries/service'

/** A local-source catalog on its own database. */
export function newLocalCatalog(): LocalLibraryCatalog {
  return new LocalLibraryCatalog(`local-${crypto.randomUUID()}`)
}

/** A service that reads and publishes through `local`, with an empty mirror beside it. */
export function serviceOn(local: LocalLibraryCatalog): LibraryService {
  const mirror = new LocalLibraryCatalog(`mirror-${crypto.randomUUID()}`)
  return new LibraryService(new MirroredLibraryCatalog(local, async () => null, mirror))
}
