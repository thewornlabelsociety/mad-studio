"use client"

/**
 * Save images straight into a folder on this computer (e.g. the Dropbox
 * folder), chosen once and remembered. Chrome and Edge only; elsewhere the
 * caller falls back to downloads.
 */

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: "readwrite"; startIn?: string }) => Promise<DirectoryHandle>
}

const DB_NAME = "mad-studio"
const STORE = "folders"
const KEY = "story-folder"

export function canSaveToFolder(): boolean {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function"
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readHandle(): Promise<DirectoryHandle | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) ?? null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function writeHandle(handle: DirectoryHandle): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(handle, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* asked again next time */
  }
}

/** The remembered folder's name, or null when none is chosen yet. */
export async function savedFolderName(): Promise<string | null> {
  return (await readHandle())?.name ?? null
}

/** Ask for a folder (start in Documents; pick Dropbox). Must run from a click. */
export async function chooseFolder(): Promise<string | null> {
  const picker = (window as PickerWindow).showDirectoryPicker
  if (!picker) return null
  try {
    const handle = await picker({ id: "wls-stories", mode: "readwrite", startIn: "documents" })
    await writeHandle(handle)
    return handle.name
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null
    throw error
  }
}

/**
 * The folder, with write permission. Run from a click: Chrome asks once per
 * session to allow it again, and the first time to choose one.
 */
export async function folderForSaving(): Promise<DirectoryHandle | null> {
  let handle = await readHandle()
  if (!handle) {
    if (!(await chooseFolder())) return null
    handle = await readHandle()
    if (!handle) return null
  }
  const state = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted"
  if (state === "granted") return handle
  const asked = (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied"
  return asked === "granted" ? handle : null
}

/** "WLS Stories 30 Oct 2026" */
export function todaysSubfolder(date = new Date()): string {
  return `WLS Stories ${date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`
}

/** Write the files into `subfolder` inside the folder. Returns how many were written. */
export async function writeToFolder(
  folder: DirectoryHandle,
  subfolder: string,
  files: Array<{ blob: Blob; filename: string }>
): Promise<number> {
  const dir = await folder.getDirectoryHandle(subfolder, { create: true })
  let written = 0
  for (const file of files) {
    const handle = await dir.getFileHandle(file.filename, { create: true })
    const stream = await handle.createWritable()
    await stream.write(file.blob)
    await stream.close()
    written++
  }
  return written
}
