import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'

/* ------------------------------------------------------------------ */
/*  LOCAL AXIOS INSTANCE                                               */
/* ------------------------------------------------------------------ */
const api = axios.create({ baseURL: 'http://localhost:5000/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Request failed'
    return Promise.reject(new Error(message))
  }
)

/* ------------------------------------------------------------------ */
/*  LOCAL HELPERS                                                      */
/* ------------------------------------------------------------------ */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const ITEMS_PER_PAGE = 20

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const totalMedicineUnits = (item) => {
  const storedUnits = Number(item.totalMedicineQuantity)
  const stripStock = Number(item.stock || 0)
  if (storedUnits > 0 || stripStock === 0) return storedUnits
  return stripStock * (Number(item.tabletsPerStrip) || 1)
}

const toDateInput = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

async function uploadToCloudinary(file) {
  if (!file) return { url: '', publicId: '' }
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Please add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your frontend .env file.'
    )
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'medical-app/medicines')

  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    formData
  )
  return { url: data.secure_url || '', publicId: data.public_id || '' }
}

/* ------------------------------------------------------------------ */
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
}

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  LOCAL UI PIECES                                                    */
/* ------------------------------------------------------------------ */
function Field({ label, hint, full, children }) {
  return (
    <label className={`field${full ? ' field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="switch-track"><span className="switch-dot" /></span>
      <span className="switch-label">{label}</span>
    </button>
  )
}

function Empty({ icon = 'box', title, text }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
    </div>
  )
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="sk sk-avatar" />
          <span className="sk sk-line" />
          <span className="sk sk-line short" />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  EDIT MODAL                                                         */
/* ------------------------------------------------------------------ */
function EditModal({ item, kind, onClose, onSaved, pushToast }) {
  const [form, setForm] = useState(() => ({
    ...item,
    price: item.price ?? '',
    stock: item.stock ?? '',
    tabletsPerStrip: item.tabletsPerStrip ?? 1,
    expiryDate: toDateInput(item.expiryDate),
  }))
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const totalQuantity = Math.round(
    (Number(form.stock) || 0) * (Number(form.tabletsPerStrip) || 1)
  )

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let imageUrl = form.image || ''
      let cloudinaryPublicId = form.cloudinaryPublicId || ''
      const replacedImage = Boolean(imageFile)

      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile)
        imageUrl = uploadResult.url
        cloudinaryPublicId = uploadResult.publicId
      }

      const payload = {
        name: form.name,
        image: imageUrl,
        cloudinaryPublicId,
        description: form.description,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        expiryDate: form.expiryDate || undefined,
        ...(kind === 'medicine'
          ? {
              manufacturer: form.manufacturer,
              tabletsPerStrip: Number(form.tabletsPerStrip) || 1,
              prescriptionRequired: Boolean(form.prescriptionRequired),
            }
          : {}),
      }

      const data =
        kind === 'medicine'
          ? await api.patch(`/medicine/${item._id}`, payload)
          : await api.patch(`/nonmedicinal/${item._id}`, payload)

      pushToast(
        replacedImage
          ? 'Previous image removed and new image saved successfully'
          : data.message || 'Item updated successfully'
      )
      onSaved?.()
      onClose()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>Edit {kind === 'medicine' ? 'medicine' : 'item'}</h3>
            <p>{item.name}</p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <form className="form-grid" onSubmit={save}>
          <Field label="Name">
            <input className="input" value={form.name} onChange={set('name')} required />
          </Field>

          {kind === 'medicine' && (
            <Field label="Manufacturer">
              <input
                className="input"
                value={form.manufacturer || ''}
                onChange={set('manufacturer')}
                required
              />
            </Field>
          )}

          <Field label="Replace image" full>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            <span className="field-hint">
              Upload a new image and Cloudinary will return the secure URL automatically.
            </span>
          </Field>

          <Field label="Description" full>
            <textarea
              className="input textarea"
              rows="2"
              value={form.description || ''}
              onChange={set('description')}
            />
          </Field>

          {kind === 'medicine' && (
            <Field label="Tablets / strip">
              <input
                className="input"
                type="number"
                min="1"
                value={form.tabletsPerStrip}
                onChange={set('tabletsPerStrip')}
              />
            </Field>
          )}

          {kind === 'medicine' && (
            <Field label="Total tablets" hint="Stock strips × tablets per strip">
              <input className="input" type="number" value={totalQuantity} readOnly />
            </Field>
          )}

          <Field label="Price (₹)">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={set('price')}
            />
          </Field>

          <Field label={kind === 'medicine' ? 'Stock (strips)' : 'Stock'}>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={form.stock}
              onChange={set('stock')}
            />
          </Field>

          <Field label="Expiry date">
            <input
              className="input"
              type="date"
              value={form.expiryDate}
              onChange={set('expiryDate')}
            />
          </Field>

          {kind === 'medicine' && (
            <div className="field field-full">
              <Switch
                checked={Boolean(form.prescriptionRequired)}
                onChange={(v) => setForm((p) => ({ ...p, prescriptionRequired: v }))}
                label="Prescription required"
              />
            </div>
          )}

          <footer className="form-foot field-full">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Icon name="check" size={18} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  UPDATE ITEMS                                                       */
/* ------------------------------------------------------------------ */
export default function UpdateItems({
  medicines,
  nonMedicines,
  loading,
  reload,
  pushToast,
}) {
  const [kind, setKind] = useState('medicine')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [editing, setEditing] = useState(null)
  const [adjustingStockId, setAdjustingStockId] = useState(null)
  const [stripCounts, setStripCounts] = useState({})

  const source = kind === 'medicine' ? medicines : nonMedicines

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return source
    return source.filter((it) =>
      [it.name, it.manufacturer, it.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [source, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])
  const firstItem = filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const lastItem = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

  const goToPage = (nextPage) => {
    const safePage = Math.min(Math.max(1, nextPage), pageCount)
    setPage(safePage)
    setPageInput(String(safePage))
  }

  const handleDelete = async (item) => {
    const label = kind === 'medicine' ? 'medicine' : 'non-medicinal item'
    const confirmed = window.confirm(`Delete "${item.name}" from ${label}s?`)
    if (!confirmed) return

    try {
      const data =
        kind === 'medicine'
          ? await api.delete(`/medicine/${item._id}`)
          : await api.delete(`/nonmedicinal/${item._id}`)

      pushToast(data.message || `${label} deleted successfully`)
      await reload?.()
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  const adjustItemStock = async (item, direction) => {
    const quantity = Number(stripCounts[item._id] ?? '1')
    const isMedicine = kind === 'medicine'
    if (!Number.isInteger(quantity) || quantity < 1) {
      pushToast(`Enter a positive whole number of ${isMedicine ? 'strips' : 'items'}`, 'error')
      return
    }

    setAdjustingStockId(item._id)
    try {
      const endpoint = isMedicine ? `/medicine/${item._id}/stock` : `/nonmedicinal/${item._id}/stock`
      const payload = isMedicine ? { direction, stripCount: quantity } : { direction, quantity }
      const data = await api.post(endpoint, payload)
      pushToast(data.message || 'Inventory stock updated')
      await reload?.()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setAdjustingStockId(null)
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="segmented">
          <span
            className="segmented-thumb"
            style={{ transform: kind === 'medicine' ? 'translateX(0)' : 'translateX(100%)' }}
          />
          <button
            type="button"
            className={kind === 'medicine' ? 'active' : ''}
            onClick={() => { setKind('medicine'); goToPage(1) }}
          >
            <Icon name="pill" size={17} /> Medicines
          </button>
          <button
            type="button"
            className={kind !== 'medicine' ? 'active' : ''}
            onClick={() => { setKind('nonmedicinal'); goToPage(1) }}
          >
            <Icon name="box" size={17} /> Non-Medicinal
          </button>
        </div>

        <div className="search">
          <Icon name="search" size={18} />
          <input
            placeholder={`Search ${kind === 'medicine' ? 'medicines' : 'items'}…`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); goToPage(1) }}
          />
          {query && (
            <button className="search-clear" onClick={() => { setQuery(''); goToPage(1) }}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <header className="panel-head">
          <h3>{filtered.length} item{filtered.length === 1 ? '' : 's'}</h3>
          <button className="link-btn" onClick={reload}>Refresh ↻</button>
        </header>

        {loading ? (
          <Skeleton rows={4} />
        ) : filtered.length === 0 ? (
          <Empty
            icon="search"
            title="Nothing found"
            text="Try a different search term or add a new item."
          />
        ) : (
          <div className="table update-items-table">
            <div className="table-head update-items-head">
              <span>Item</span>
              <span>Price</span>
              <span>{kind === 'medicine' ? 'Stock / Total' : 'Stock'}</span>
              <span>{kind === 'medicine' ? 'Adjust strips' : 'Adjust units'}</span>
              <span>Expiry</span>
              <span />
            </div>
            <div className="table-body">
                {pageItems.map((it, i) => (
                <div
                  className="table-row update-items-row"
                  key={it._id || i}
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <div className="cell-item update-item-product">
                    <span className="thumb">
                      {it.image ? (
                        <img src={it.image} alt="" />
                      ) : (
                        <Icon name={kind === 'medicine' ? 'pill' : 'box'} size={18} />
                      )}
                    </span>
                    <div>
                      <strong>{it.name}</strong>
                      <span>{kind === 'medicine' ? it.manufacturer : 'Non-medicinal'}</span>
                    </div>
                  </div>

                  <span className="cell update-item-price">
                    <strong>{money(it.price)}</strong>
                    {kind === 'medicine' && <small>per strip</small>}
                  </span>

                  <span
                    className={`cell update-item-stock ${Number(it.stock) <= 10 ? 'low' : ''}`}
                  >
                    <strong>{kind === 'medicine' ? `${it.stock ?? 0} strips` : it.stock ?? 0}</strong>
                    {kind === 'medicine' && (
                      <small>
                        {totalMedicineUnits(it).toLocaleString('en-IN')} tablets
                      </small>
                    )}
                  </span>

                  <div className="update-stock-controls update-item-pack">
                    <span className="update-stock-label">
                      Adjust {kind === 'medicine' ? 'strips' : 'units'}
                    </span>
                    <button
                      type="button"
                      className="stock-adjust-btn stock-remove-btn"
                      onClick={() => adjustItemStock(it, 'remove')}
                      disabled={adjustingStockId === it._id || Number(it.stock) < 1}
                      title={`Remove ${stripCounts[it._id] || 1} ${kind === 'medicine' ? 'strip(s)' : 'item(s)'}`}
                      aria-label={`Remove selected ${kind === 'medicine' ? 'strips' : 'items'} of ${it.name}`}
                    >
                      <Icon name="minus" size={14} />
                      <span>Remove</span>
                    </button>
                    <input
                      className="stock-adjust-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={stripCounts[it._id] ?? '1'}
                      onChange={(event) => setStripCounts((current) => ({
                        ...current,
                        [it._id]: event.target.value,
                      }))}
                      aria-label={`Number of ${kind === 'medicine' ? 'strips' : 'items'} to adjust for ${it.name}`}
                      title={kind === 'medicine' ? 'Number of strips' : 'Number of items'}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="stock-adjust-btn stock-add-btn"
                      onClick={() => adjustItemStock(it, 'add')}
                      disabled={adjustingStockId === it._id}
                      title={`Add ${stripCounts[it._id] || 1} ${kind === 'medicine' ? 'strip(s)' : 'item(s)'}`}
                      aria-label={`Add selected ${kind === 'medicine' ? 'strips' : 'items'} of ${it.name}`}
                    >
                      <Icon name="plus" size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <span className="cell muted update-item-expiry">{toDateInput(it.expiryDate) || '—'}</span>

                  <div className="cell-actions update-item-actions">
                    <button
                      className="btn-icon-sm"
                      onClick={() => setEditing(it)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      className="btn-icon-sm danger"
                      onClick={() => handleDelete(it)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <nav className="inventory-pagination" aria-label="Inventory pages">
            <span className="inventory-page-range">
              {firstItem}–{lastItem} of {filtered.length} items
            </span>
            <div className="inventory-page-controls">
              <button
                type="button"
                className="inventory-page-button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                Previous
              </button>
              <label className="inventory-page-jump">
                <span>Page</span>
                <input
                  type="number"
                  min="1"
                  max={pageCount}
                  value={pageInput}
                  aria-label="Go to page number"
                  onChange={(event) => setPageInput(event.target.value)}
                  onBlur={() => goToPage(Number(pageInput) || currentPage)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
                <span>of {pageCount}</span>
              </label>
              <button
                type="button"
                className="inventory-page-button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>

      {editing && (
        <EditModal
          item={editing}
          kind={kind}
          pushToast={pushToast}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}