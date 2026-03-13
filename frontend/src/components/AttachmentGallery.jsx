import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperClipIcon, TrashIcon, ArrowDownTrayIcon, PhotoIcon,
  DocumentIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { uploadsApi } from '../api/uploads'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function LightboxModal({ att, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        className="relative max-w-4xl max-h-screen p-4"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
        <img
          src={uploadsApi.fileUrl(att.id)}
          alt={att.original_name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        <p className="text-center text-white/70 text-sm mt-2">{att.original_name}</p>
      </motion.div>
    </motion.div>
  )
}

export default function AttachmentGallery({ entityType, entityId }) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [lightbox, setLightbox] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (entityId) loadAttachments()
  }, [entityType, entityId])

  const loadAttachments = async () => {
    setLoading(true)
    try {
      const data = await uploadsApi.list(entityType, entityId)
      setAttachments(data)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setUploadProgress(0)
    for (const file of files) {
      try {
        const att = await uploadsApi.upload(entityType, entityId, file, (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        setAttachments(prev => [att, ...prev])
        toast.success(`Uploaded: ${file.name}`)
      } catch (e) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    setUploading(false)
    setUploadProgress(0)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this attachment?')) return
    try {
      await uploadsApi.delete(id)
      setAttachments(prev => prev.filter(a => a.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const isImage = (att) => IMAGE_TYPES.includes(att.mime_type)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <PaperClipIcon className="w-4 h-4" />
          Attachments
          {attachments.length > 0 && <span className="text-gray-400">({attachments.length})</span>}
        </h3>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-brand-600 hover:text-brand-700 dark:hover:text-brand-400 font-medium transition-colors"
        >
          + Upload
        </button>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => handleUpload(Array.from(e.target.files))}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleUpload(Array.from(e.dataTransfer.files)) }}
        className={clsx(
          'border-2 border-dashed rounded-lg p-3 text-center text-xs transition-all cursor-pointer',
          dragging
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
            : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
        )}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="space-y-1">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <motion.div className="h-full bg-brand-500 rounded-full" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>Uploading... {uploadProgress}%</span>
          </div>
        ) : (
          'Drop files here or click to upload'
        )}
      </div>

      {/* Image thumbnails */}
      {attachments.some(isImage) && (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {attachments.filter(isImage).map(att => (
              <motion.div key={att.id}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
                onClick={() => setLightbox(att)}
              >
                <img
                  src={att.has_thumbnail ? uploadsApi.thumbUrl(att.id) : uploadsApi.fileUrl(att.id)}
                  alt={att.original_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-between p-1.5 opacity-0 group-hover:opacity-100">
                  <a href={uploadsApi.fileUrl(att.id)} download onClick={e => e.stopPropagation()}
                    className="p-1 bg-white/90 rounded text-gray-700 hover:bg-white">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={e => { e.stopPropagation(); handleDelete(att.id) }}
                    className="p-1 bg-red-500/90 rounded text-white hover:bg-red-600">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Non-image files */}
      {attachments.filter(a => !isImage(a)).length > 0 && (
        <div className="space-y-1.5">
          <AnimatePresence>
            {attachments.filter(a => !isImage(a)).map(att => (
              <motion.div key={att.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
              >
                <DocumentIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{att.original_name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(att.file_size)}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={uploadsApi.fileUrl(att.id)} download
                    className="p-1 text-gray-400 hover:text-brand-600 transition-colors">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(att.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!loading && attachments.length === 0 && (
        <div className="text-center py-4 text-gray-400 dark:text-gray-500">
          <PhotoIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
          <p className="text-xs">No attachments yet</p>
        </div>
      )}

      <AnimatePresence>
        {lightbox && <LightboxModal att={lightbox} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </div>
  )
}
