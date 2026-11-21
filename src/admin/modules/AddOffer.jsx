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

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

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
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
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

/* ------------------------------------------------------------------ */
/*  FREE ITEM SELECTOR (inline)                                        */
/* ------------------------------------------------------------------ */
function FreeItemSelector({ items = [], value, onChange, onCreated, pushToast }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('list')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', expiryDate: '' })
  const [imageFile, setImageFile] = useState(null)
  const [creating, setCreating] = useState(false)

  const selected = useMemo(
    () => items.find((it) => it._id === value) || null,
    [items, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => String(it.name || '').toLowerCase().includes(q))
  }, [items, query])

  const openModal = () => { setOpen(true); setMode('list'); setQuery('') }
  const closeModal = () => { setOpen(false); setMode('list'); setQuery(''); setImageFile(null) }

  const pick = (item) => {
    onChange(item._id)
    closeModal()
  }

  const startCreate = () => {
    setMode('create')
    setForm({ name: query.trim() || '', description: '', price: '', stock: '', expiryDate: '' })
  }

  const resetCreateForm = () => {
    setForm({ name: '', description: '', price: '', stock: '', expiryDate: '' })
    setImageFile(null)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { pushToast('Please enter a name for the new item', 'error'); return }
    setCreating(true)
    try {
      let imageUrl = ''
      let cloudinaryPublicId = ''
      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile)
        imageUrl = uploadResult.url
        cloudinaryPublicId = uploadResult.publicId
      }
      if (!imageUrl) throw new Error('Please select an image for the new item.')

      const data = await api.post('/nonmedicinal', {
        name: form.name,
        image: imageUrl,
        cloudinaryPublicId,
        description: form.description,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        expiryDate: form.expiryDate || undefined,
      })

      const created = data.item || data
      pushToast(data.message || 'Item created successfully')
      onCreated?.(created)
      onChange(created._id)
      resetCreateForm()
      closeModal()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className={`fis-trigger${selected ? ' has-value' : ''}`}
        onClick={openModal}
      >
        {selected ? (
          <span className="fis-chip">
            <span className="fis-chip-thumb">
              {selected.image ? <img src={selected.image} alt="" /> : <Icon name="box" size={14} />}
            </span>
            <span className="fis-chip-name">{selected.name}</span>
            <span
              className="fis-chip-remove"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onChange('')
                }
              }}
              aria-label="Remove selected item"
            >
              <Icon name="close" size={12} />
            </span>
          </span>
        ) : (
          <span className="fis-placeholder">
            <Icon name="box" size={16} />
            Click to select a free item…
          </span>
        )}
        <span className="fis-trigger-icon"><Icon name="search" size={16} /></span>
      </button>

      {open && createPortal(
        <div className="fis-backdrop" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="fis-modal" onClick={(e) => e.stopPropagation()}>
            <header className="fis-head">
              <div>
                <h3>{mode === 'list' ? 'Select free item' : 'Create non-medicinal item'}</h3>
                <p>
                  {mode === 'list'
                    ? 'Search and pick a product, or create a new one'
                    : 'Fill in the details — the new item is saved and auto-selected'}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </header>

            {mode === 'list' ? (
              <>
                <div className="fis-search">
                  <Icon name="search" size={18} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search non-medicinal items…"
                  />
                  {query && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>

                <div className="fis-toolbar">
                  <button type="button" className="btn btn-primary" onClick={startCreate}>
                    <Icon name="plus" size={16} /> Add new item
                  </button>
                  <span className="fis-count">
                    {filtered.length} item{filtered.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="fis-list-wrap">
                  {filtered.length === 0 ? (
                    <div className="fis-empty">
                      <div className="fis-empty-icon"><Icon name="search" size={22} /></div>
                      <h4>No items found</h4>
                      <p>Try a different search, or create a new one.</p>
                      <button type="button" className="btn btn-primary" onClick={startCreate}>
                        <Icon name="plus" size={16} /> Create "{query.trim() || 'new item'}"
                      </button>
                    </div>
                  ) : (
                    <ul className="fis-list" role="listbox">
                      {filtered.map((it) => {
                        const isSelected = it._id === value
                        return (
                          <li
                            key={it._id}
                            role="option"
                            aria-selected={isSelected}
                            className={`fis-item${isSelected ? ' is-selected' : ''}`}
                            onClick={() => pick(it)}
                          >
                            <span className="fis-item-thumb">
                              {it.image ? <img src={it.image} alt="" /> : <Icon name="box" size={18} />}
                            </span>
                            <div className="fis-item-main">
                              <strong>{it.name}</strong>
                              <span>{it.description || 'Non-medicinal item'}</span>
                            </div>
                            <div className="fis-item-meta">
                              <b>{money(it.price)}</b>
                              <span>{it.stock ?? 0} in stock</span>
                            </div>
                            {isSelected && (
                              <span className="fis-item-check"><Icon name="check" size={16} /></span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="fis-form">
                <div className="form-grid">
                  <Field label="Item name" full>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Vitamin C Tablets"
                      autoFocus
                    />
                  </Field>

                  <Field label="Product image" full>
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    <span className="field-hint">Uploaded to Cloudinary automatically.</span>
                  </Field>

                  <Field label="Description" full>
                    <textarea
                      className="input textarea"
                      rows="2"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Short description…"
                    />
                  </Field>

                  <Field label="Price (₹)">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </Field>

                  <Field label="Stock quantity">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>

                  <Field label="Expiry date" full>
                    <input
                      className="input"
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    />
                  </Field>
                </div>

                <footer className="form-foot">
                  <button type="button" className="btn btn-ghost" onClick={() => setMode('list')}>
                    <Icon name="arrowLeft" size={16} /> Back to list
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={creating}
                    onClick={handleCreate}
                  >
                    {creating ? <span className="spinner" /> : <Icon name="plus" size={16} />}
                    {creating ? 'Creating…' : 'Create & select'}
                  </button>
                </footer>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  ADD OFFER                                                          */
/* ------------------------------------------------------------------ */
export default function AddOffer({
  offers,
  homepageOffer,
  nonMedicines,
  onNonMedicinalCreated,
  reload,
  pushToast,
}) {
  const [banner, setBanner] = useState(homepageOffer || '')
  const [savingBanner, setSavingBanner] = useState(false)
  const [offer, setOffer] = useState({
    minAmount: '',
    maxAmount: '',
    discountPercentage: '',
    freeItem: '',
    isActive: true,
  })
  const [savingOffer, setSavingOffer] = useState(false)

  useEffect(() => { setBanner(homepageOffer || '') }, [homepageOffer])

  const set = (k) => (e) => setOffer((p) => ({ ...p, [k]: e.target.value }))

  const saveBanner = async () => {
    setSavingBanner(true)
    try {
      await api.patch('/admin/settings', { homepageOffer: banner })
      pushToast('Homepage offer updated')
      reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSavingBanner(false)
    }
  }

  const submitOffer = async (e) => {
    e.preventDefault()
    setSavingOffer(true)
    try {
      const data = await api.post('/admin/offers', {
        minAmount: Number(offer.minAmount) || 0,
        maxAmount: offer.maxAmount ? Number(offer.maxAmount) : undefined,
        discountPercentage: offer.discountPercentage
          ? Number(offer.discountPercentage)
          : undefined,
        freeItem: offer.freeItem || undefined,
        isActive: offer.isActive,
      })
      pushToast(data.message || 'Offer created successfully')
      setOffer({
        minAmount: '',
        maxAmount: '',
        discountPercentage: '',
        freeItem: '',
        isActive: true,
      })
      reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSavingOffer(false)
    }
  }

  const deleteOffer = async (id) => {
    try {
      await api.delete(`/admin/offers/${id}`)
      pushToast('Offer removed')
      reload()
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  const freeItemName = (o) => {
    if (!o.freeItem) return null
    if (typeof o.freeItem === 'object' && o.freeItem.name) return o.freeItem.name
    return nonMedicines.find((it) => it._id === o.freeItem)?.name || 'free item'
  }

  return (
    <div className="stack">
      <section className="panel banner-panel">
        <header className="panel-head">
          <h3>Homepage banner text</h3>
          <span className="count-chip">Live</span>
        </header>
        <div className="banner-row">
          <input
            className="input"
            placeholder="e.g. Flat 20% off on all medicines above ₹999"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
          />
          <button className="btn btn-primary" onClick={saveBanner} disabled={savingBanner}>
            {savingBanner ? <span className="spinner" /> : <Icon name="check" size={18} />}
            {savingBanner ? 'Saving…' : 'Save banner'}
          </button>
        </div>
      </section>

      <div className="split">
        <form className="panel" onSubmit={submitOffer}>
          <header className="panel-head"><h3>Create a new offer</h3></header>

          <div className="form-grid">
            <Field label="Minimum amount (₹)">
              <input
                className="input"
                type="number"
                min="0"
                value={offer.minAmount}
                onChange={set('minAmount')}
                placeholder="999"
                required
              />
            </Field>
            <Field label="Maximum amount (₹)" hint="Leave empty for no upper limit">
              <input
                className="input"
                type="number"
                min="0"
                value={offer.maxAmount}
                onChange={set('maxAmount')}
                placeholder="4999"
              />
            </Field>
            <Field label="Discount %">
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={offer.discountPercentage}
                onChange={set('discountPercentage')}
                placeholder="20"
              />
            </Field>

            <div className="field field-full">
              <span className="field-label">Free item (optional)</span>
              <FreeItemSelector
                items={nonMedicines}
                value={offer.freeItem}
                onChange={(id) => setOffer((p) => ({ ...p, freeItem: id || '' }))}
                onCreated={onNonMedicinalCreated}
                pushToast={pushToast}
              />
              <span className="field-hint">
                Search & pick a non-medicinal product — its ID is stored automatically. You can
                also create a brand-new item.
              </span>
            </div>

            <div className="field field-full">
              <Switch
                checked={offer.isActive}
                onChange={(v) => setOffer((p) => ({ ...p, isActive: v }))}
                label="Activate immediately"
              />
            </div>
          </div>

          <footer className="form-foot">
            <button type="submit" className="btn btn-primary" disabled={savingOffer}>
              {savingOffer ? <span className="spinner" /> : <Icon name="tag" size={18} />}
              {savingOffer ? 'Creating…' : 'Create offer'}
            </button>
          </footer>
        </form>

        <div className="panel">
          <header className="panel-head">
            <h3>Existing offers</h3>
            <span className="count-chip">{offers.length}</span>
          </header>

          {offers.length === 0 ? (
            <Empty icon="tag" title="No offers yet" text="Create your first discount offer." />
          ) : (
            <ul className="offer-list">
              {offers.map((o, i) => (
                <li
                  key={o._id || i}
                  className="offer-row"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="offer-badge">
                    <Icon name="tag" size={16} />
                  </span>
                  <div className="offer-main">
                    <strong>
                      {money(o.minAmount)}
                      {o.maxAmount ? ` – ${money(o.maxAmount)}` : '+'}
                    </strong>
                    <span>
                      {o.discountPercentage ? `${o.discountPercentage}% off` : 'Special offer'}
                      {o.freeItem && (
                        <>
                          {' + '}
                          <strong className="offer-free-name">{freeItemName(o)}</strong>
                        </>
                      )}
                    </span>
                  </div>
                  <span className={`badge ${o.isActive === false ? 'badge-muted' : 'badge-ok'}`}>
                    {o.isActive === false ? 'Inactive' : 'Active'}
                  </span>
                  <button
                    className="icon-btn danger"
                    onClick={() => deleteOffer(o._id)}
                    title="Delete offer"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}