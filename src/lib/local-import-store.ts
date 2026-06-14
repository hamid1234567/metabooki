import { openDB } from 'idb'
import type { LocalImportProject, WordImportAnalysis } from '@/lib/word-import-types'

const DB_NAME = 'metabooki-private-imports'
const STORE_NAME = 'projects'

const database = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  },
})

async function saveToOpfs(projectId: string, file: File) {
  if (!navigator.storage?.getDirectory) return
  const root = await navigator.storage.getDirectory()
  const imports = await root.getDirectoryHandle('metabooki-imports', { create: true })
  const handle = await imports.getFileHandle(`${projectId}.docx`, { create: true })
  const writer = await handle.createWritable()
  await writer.write(file)
  await writer.close()
}

export async function saveLocalImport(project: LocalImportProject) {
  const db = await database
  await db.put(STORE_NAME, project)
  try {
    await saveToOpfs(project.id, project.sourceFile)
  } catch {
    // IndexedDB remains the compatible private-storage fallback.
  }
}

export async function updateLocalAnalysis(id: string, analysis: WordImportAnalysis) {
  const project = await getLocalImport(id)
  if (!project) return
  await saveLocalImport({ ...project, analysis, updatedAt: new Date().toISOString() })
}

export async function getLocalImport(id: string): Promise<LocalImportProject | undefined> {
  const db = await database
  return db.get(STORE_NAME, id)
}

export async function deleteLocalImport(id: string) {
  const db = await database
  await db.delete(STORE_NAME, id)
  try {
    if (!navigator.storage?.getDirectory) return
    const root = await navigator.storage.getDirectory()
    const imports = await root.getDirectoryHandle('metabooki-imports')
    await imports.removeEntry(`${id}.docx`)
  } catch {
    // The file may only exist in IndexedDB.
  }
}

export async function clearExpiredLocalImports(maxAgeDays = 14) {
  const db = await database
  const projects = await db.getAll(STORE_NAME) as LocalImportProject[]
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  await Promise.all(projects.filter(item => +new Date(item.updatedAt) < cutoff).map(item => deleteLocalImport(item.id)))
}
