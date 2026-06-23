export function createDocumentSourceState() {
  let fileHandle: FileSystemFileHandle | null = null
  let filePath: string | null = null
  let downloadName: string | null = null
  let savedVersion = 0
  let lastWriteTime = 0

  // Identity metadata used for deduplication across all platforms.
  // Kept separate from the save/watch filePath/fileHandle because those are
  // intentionally limited to .fig files today, while identity must work for .pen
  // and browser fallback files too.
  let sourceHandle: FileSystemFileHandle | null = null
  let sourcePath: string | null = null
  let sourceFileName: string | null = null

  return {
    getFileHandle: () => fileHandle,
    setFileHandle: (handle: FileSystemFileHandle | null) => {
      fileHandle = handle
    },
    getFilePath: () => filePath,
    setFilePath: (path: string | null) => {
      filePath = path
    },
    getDownloadName: () => downloadName,
    setDownloadName: (name: string | null) => {
      downloadName = name
    },
    getSavedVersion: () => savedVersion,
    setSavedVersion: (version: number) => {
      savedVersion = version
    },
    getLastWriteTime: () => lastWriteTime,
    setLastWriteTime: (time: number) => {
      lastWriteTime = time
    },
    getSourceHandle: () => sourceHandle,
    setSourceHandle: (handle: FileSystemFileHandle | null) => {
      sourceHandle = handle
    },
    getSourcePath: () => sourcePath,
    setSourcePath: (path: string | null) => {
      sourcePath = path
    },
    getSourceFileName: () => sourceFileName,
    setSourceFileName: (name: string | null) => {
      sourceFileName = name
    }
  }
}
