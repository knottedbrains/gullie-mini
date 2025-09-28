import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { FileUp, Paperclip, Trash2 } from 'lucide-react'
import type { TaskAction } from '../types/timeline'

type UploadAction = Extract<TaskAction, { type: 'upload' }>

interface UploadActionCardProps {
  taskId: string
  action: UploadAction
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function storageKey(taskId: string, action: UploadAction) {
  return `gullie-mini:uploads:${taskId}:${action.id ?? slugify(action.label)}`
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadedAt: string
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(16).slice(2)
}

export function UploadActionCard({ taskId, action }: UploadActionCardProps) {
  const key = useMemo(() => storageKey(taskId, action), [taskId, action])
  const [uploads, setUploads] = useState<UploadedFile[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw) as UploadedFile[]
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('Failed to read uploads state', error)
      return []
    }
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(uploads))
    } catch (storageError) {
      console.warn('Failed to persist uploads', storageError)
    }
  }, [key, uploads])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      if (!files.length) {
        return
      }
      setError(null)
      const items: UploadedFile[] = files.map((file) => ({
        id: generateId(),
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }))
      setUploads((prev) => [...prev, ...items])
      event.target.value = ''
    },
    [],
  )

  const handleRemove = useCallback((id: string) => {
    setUploads((prev) => prev.filter((file) => file.id !== id))
  }, [])

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200">
          <FileUp className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">{action.label}</p>
          {action.instructions ? (
            <p className="text-xs text-slate-300/90">{action.instructions}</p>
          ) : null}
        </div>
      </div>

      <label className="flex flex-col items-start gap-2 text-xs font-medium text-slate-300">
        Choose files
        <input
          type="file"
          multiple
          accept={action.accept}
          onChange={handleFileChange}
          className="block cursor-pointer text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/30 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-50 hover:file:bg-amber-500/50"
        />
        {action.accept ? (
          <span className="text-[11px] text-slate-400">Accepted types: {action.accept}</span>
        ) : null}
      </label>

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      <div className="space-y-2">
        {uploads.length === 0 ? (
          <p className="text-xs text-slate-400">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2 text-xs text-slate-200">
            {uploads.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-100">{file.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatBytes(file.size)} · Uploaded {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(file.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition hover:border-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
