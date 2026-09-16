import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  deleteWholesaleImage,
  getWholesaleCategoriesAdmin,
  getWholesaleImagesAdmin,
  reorderWholesaleImages,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { CardSkeleton } from '../../components/admin/Skeleton'
import WholesaleImageModal from '../../components/admin/WholesaleImageModal'
import WholesaleCategoryManager from '../../components/admin/WholesaleCategoryManager'

function DragHandleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SortableImageCard({ image, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ touchAction: 'none' }}
        className="absolute left-2 top-2 z-10 flex h-10 w-10 cursor-grab select-none items-center justify-center rounded-md bg-white/90 text-slate-500 shadow hover:text-slate-900 active:cursor-grabbing"
      >
        <DragHandleIcon className="h-4 w-4" />
      </button>

      <img src={image.url} alt={image.caption || ''} className="aspect-[4/5] w-full object-cover" loading="lazy" />

      <div className="p-2.5">
        {image.caption && <p className="truncate text-xs font-medium text-slate-700">{image.caption}</p>}
        {image.category && <p className="mt-0.5 truncate text-xs text-slate-400">{image.category}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(image)}
            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(image)}
            className="flex-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminWholesale() {
  const { show } = useToast()
  const [images, setImages] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [modalImage, setModalImage] = useState(undefined) // undefined = closed, null = add, object = edit
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = async () => {
    setLoading(true)
    try {
      const [imgs, cats] = await Promise.all([getWholesaleImagesAdmin(), getWholesaleCategoriesAdmin()])
      setImages(imgs)
      setCategories(cats)
    } catch {
      show('Failed to load wholesale gallery', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(
    () => (activeCategory ? images.filter((img) => img.category === activeCategory) : images),
    [images, activeCategory]
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = visible.findIndex((img) => img.id === active.id)
    const newIndex = visible.findIndex((img) => img.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reorderedVisible = arrayMove(visible, oldIndex, newIndex)

    // Drag only reorders within the currently filtered view, but persisted
    // sortOrder spans all images — splice the reordered visible slice back
    // into its original positions in the full list.
    const visibleIds = new Set(visible.map((img) => img.id))
    let cursor = 0
    const nextImages = images.map((img) => (visibleIds.has(img.id) ? reorderedVisible[cursor++] : img))

    setImages(nextImages)
    try {
      await reorderWholesaleImages(nextImages.map((img) => img.id))
    } catch {
      show('Failed to save new order', 'error')
      load()
    }
  }

  const runDelete = async () => {
    const image = confirmDelete
    setConfirmDelete(null)
    try {
      await deleteWholesaleImage(image.id)
      show('Image deleted', 'success')
      setImages((prev) => prev.filter((img) => img.id !== image.id))
    } catch (err) {
      show(err.message || 'Failed to delete image', 'error')
    }
  }

  const handleSaved = () => load()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-slate-900">Wholesale</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategoryManagerOpen(true)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Manage Categories
          </button>
          <button
            type="button"
            onClick={() => setModalImage(null)}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Add Images
          </button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${activeCategory === '' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${activeCategory === c ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            {activeCategory ? 'No images in this category.' : 'No wholesale images yet — add the first one.'}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((img) => img.id)} strategy={rectSortingStrategy}>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  onEdit={setModalImage}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <WholesaleImageModal
        open={modalImage !== undefined}
        image={modalImage}
        categories={categories}
        onClose={() => setModalImage(undefined)}
        onSaved={handleSaved}
      />

      <WholesaleCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        onChanged={load}
      />

      <ConfirmDialog
        open={confirmDelete != null}
        title="Delete this image?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
