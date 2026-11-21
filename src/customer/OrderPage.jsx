import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useStore } from './StoreContext'
import CustomerNavigation from './CustomerNavigation'
import './OrderPage.css'

/* ================================================================== */
/*  CONSTANTS                                                         */
/* ================================================================== */
const API_BASE = 'http://localhost:5000/api'

const api = axios.create({ baseURL: API_BASE })
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

/* Cloudinary (same vars your admin uses) */
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

/* ================================================================== */
/*  HELPERS                                                           */
/* ================================================================== */
const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const when = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const keyOf = (it) => `${it.itemType}:${it.itemId}`

async function uploadPrescription(file) {
  if (!file) throw new Error('No file selected')
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env'
    )
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', 'medical-app/prescriptions')

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    formData
  )
  return { url: res.data.secure_url || '', publicId: res.data.public_id || '' }
}

/* ================================================================== */
/*  ICONS                                                             */
/* ================================================================== */
const ICON_PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  pin: <><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8" /><path d="M12 3v12" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  warning: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
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

function ProductImage({ src, alt = '', itemType, fallbackClassName, iconSize = 16 }) {
  const [failed, setFailed] = useState(false)
  const icon = <Icon name={itemType === 'Medicine' ? 'pill' : 'box'} size={iconSize} />

  if (!src || failed) {
    return fallbackClassName ? <span className={fallbackClassName}>{icon}</span> : icon
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

/* ================================================================== */
/*  TOASTS                                                            */
/* ================================================================== */
function Toasts({ items, onDismiss }) {
  return (
    <div className="op-toasts">
      {items.map((t) => (
        <div key={t.id} className={`op-toast op-toast-${t.type}`}>
          <span className="op-toast-icon">
            <Icon name={t.type === 'error' ? 'warning' : 'check'} size={16} />
          </span>
          <span className="op-toast-msg">{t.message}</span>
          <button className="op-toast-close" onClick={() => onDismiss(t.id)}>
            <Icon name="close" size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  ITEM CARD                                                         */
/* ================================================================== */
function ItemCard({ item, onAdd }) {
  const out = item.stock <= 0
  const low = !out && item.stock <= 5
  const detailPath = `/product/${item.itemType === 'Medicine' ? 'medicine' : 'nonmedicinal'}/${item.itemId}`

  return (
    <article className={`op-card${out ? ' is-out' : ''}`}>
      <Link to={detailPath} className="op-card-detail-link">
        <div className="op-card-media">
          <ProductImage
            src={item.image}
            alt={item.name}
            itemType={item.itemType}
            fallbackClassName="op-card-media-fallback"
            iconSize={30}
          />
          {item.prescriptionRequired && <span className="op-rx-pill">Rx</span>}
          {out && <span className="op-out-pill">Out of stock</span>}
        </div>

        <h3 title={item.name}>{item.name}</h3>
        <p className="op-card-meta">{item.meta}</p>
        {item.description && <p className="op-card-desc">{item.description}</p>}
        <span className="op-view-details">View product details <Icon name="chevron" size={13} /></span>
      </Link>

      <div className="op-card-body">
        <div className="op-card-foot">
          <div className="op-card-price">
            <b>{money(item.price)}</b>
            {item.itemType === 'Medicine' && (
              <small>/ tablet · strip MRP {money(item.stripPrice)}</small>
            )}
          </div>
          {out ? (
            <span className="op-sold-out">Sold out</span>
          ) : (
            <button
              type="button"
              className="op-add-btn"
              onClick={() => onAdd(item)}
              title="Add to cart"
            >
              <Icon name="plus" size={15} /> Add
            </button>
          )}
        </div>

        {low && (
          <span className="op-low-stock">
            <Icon name="warning" size={11} /> Only {item.stock} {item.itemType === 'Medicine' ? 'tablets' : 'units'} left
          </span>
        )}
      </div>
    </article>
  )
}

/* ================================================================== */
/*  PRESCRIPTION UPLOAD (inline per Rx item)                          */
/* ================================================================== */
function PrescriptionUpload({ state, onUpload, onRemove }) {
  const uploading = state?.uploading
  const url = state?.url

  return (
    <div className="op-rx-upload">
      <span className="op-rx-upload-label">
        <Icon name="upload" size={11} /> Prescription
      </span>

      {url ? (
        <div className="op-rx-preview">
          <img src={url} alt="Prescription" />
          <button
            type="button"
            className="op-rx-remove"
            onClick={onRemove}
            aria-label="Remove prescription"
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ) : (
        <label className={`op-rx-btn${uploading ? ' is-loading' : ''}`}>
          {uploading ? 'Uploading…' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}

/* ================================================================== */
/*  ADDRESS MODAL                                                     */
/* ================================================================== */
const EMPTY_ADDRESS = {
  label: 'Home',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
}

function AddressModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_ADDRESS)
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.pincode.trim()) {
      return
    }
    onSave(form)
  }

  return createPortal(
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-modal" onClick={(e) => e.stopPropagation()}>
        <header className="op-modal-head">
          <div>
            <h3>{initial ? 'Edit address' : 'Add delivery address'}</h3>
            <p>We'll deliver your order to this address.</p>
          </div>
          <button className="op-icon-btn" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>

        <form className="op-address-form" onSubmit={submit}>
          <label className="op-field">
            <span>Label</span>
            <input
              className="op-input"
              value={form.label}
              onChange={set('label')}
              placeholder="Home / Office"
            />
          </label>

          <label className="op-field">
            <span>Full name *</span>
            <input
              className="op-input"
              value={form.name}
              onChange={set('name')}
              required
              placeholder="Your full name"
            />
          </label>

          <label className="op-field">
            <span>Phone *</span>
            <input
              className="op-input"
              value={form.phone}
              onChange={set('phone')}
              required
              placeholder="10-digit mobile number"
            />
          </label>

          <label className="op-field op-field-full">
            <span>Address line 1 *</span>
            <input
              className="op-input"
              value={form.line1}
              onChange={set('line1')}
              required
              placeholder="Flat / house / building"
            />
          </label>

          <label className="op-field op-field-full">
            <span>Address line 2</span>
            <input
              className="op-input"
              value={form.line2}
              onChange={set('line2')}
              placeholder="Street / locality (optional)"
            />
          </label>

          <label className="op-field">
            <span>City *</span>
            <input
              className="op-input"
              value={form.city}
              onChange={set('city')}
              required
            />
          </label>

          <label className="op-field">
            <span>State</span>
            <input
              className="op-input"
              value={form.state}
              onChange={set('state')}
            />
          </label>

          <label className="op-field">
            <span>Pincode *</span>
            <input
              className="op-input"
              value={form.pincode}
              onChange={set('pincode')}
              required
              inputMode="numeric"
            />
          </label>

          <footer className="op-modal-foot op-field-full">
            <button type="button" className="op-btn op-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="op-btn op-btn-primary">
              <Icon name="check" size={16} /> Save address
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ================================================================== */
/*  SUCCESS MODAL                                                     */
/* ================================================================== */
function SuccessModal({ order, onClose, onViewOrders }) {
  return createPortal(
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-modal op-success" onClick={(e) => e.stopPropagation()}>
        <div className="op-success-icon">
          <Icon name="check" size={34} />
        </div>
        <h2>Order placed 🎉</h2>
        <p className="op-success-id">
          Order ID: <b>#{String(order._id).slice(-6).toUpperCase()}</b>
        </p>

        <div className="op-success-rows">
          <div>
            <span>Total paid</span>
            <b>{money(order.totalAmount)}</b>
          </div>
          <div>
            <span>Payment</span>
            <b>{order.paymentMode}</b>
          </div>
          <div>
            <span>Status</span>
            <b>{order.orderStatus || 'Pending'}</b>
          </div>
        </div>

        <footer className="op-modal-foot" style={{ justifyContent: 'center' }}>
          <button className="op-btn op-btn-ghost" onClick={onViewOrders}>
            View my orders
          </button>
          <button className="op-btn op-btn-primary" onClick={onClose}>
            Continue shopping
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

/* ================================================================== */
/*  MY ORDERS VIEW                                                    */
/* ================================================================== */
function MyOrders({ orders, loading, addresses }) {
  const addressById = useMemo(
    () => Object.fromEntries(addresses.map((a) => [a._id, a])),
    [addresses]
  )

  if (loading) {
    return (
      <div className="op-panel">
        <div className="op-skeleton-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="op-skel-row" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="op-skel op-skel-icon" />
              <span className="op-skel op-skel-line" />
              <span className="op-skel op-skel-line short" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="op-empty op-empty-large">
        <span className="op-empty-icon"><Icon name="receipt" size={32} /></span>
        <h3>No orders yet</h3>
        <p>Your placed orders will show up here.</p>
      </div>
    )
  }

  return (
    <div className="op-orders">
      {orders.map((o, i) => {
        const addr = o.deliveryAddress || addressById[o.deliveryAddressId]
        return (
          <article
            key={o._id}
            className="op-order-card"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <header className="op-order-head">
              <div>
                <span className="op-order-id">#{String(o._id).slice(-8).toUpperCase()}</span>
                <span className="op-order-when">{when(o.createdAt)}</span>
              </div>
              <span className={`op-status op-status-${(o.orderStatus || 'pending').toLowerCase()}`}>
                {o.orderStatus || 'Pending'}
              </span>
            </header>

            <ul className="op-order-items">
              {o.items.map((it, idx) => (
                <li key={`${it.itemId}-${idx}`}>
                  <span className="op-order-item-icon">
                    <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={13} />
                  </span>
                  <span className="op-order-item-name">{it.name}</span>
                  <span className="op-order-item-qty">
                    {it.quantity} {it.quantityUnit || (it.itemType === 'Medicine' ? 'strips' : 'items')} × {money(it.unitPrice)}
                  </span>
                  <span className="op-order-item-total">
                    {money(it.quantity * it.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>

            <footer className="op-order-foot">
              <div className="op-order-addr">
                <Icon name="pin" size={12} />
                <span>
                  {addr
                    ? `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city} ${addr.pincode}`
                    : 'Delivery address'}
                </span>
              </div>
              <div className="op-order-total">
                <span>Total</span>
                <b>{money(o.totalAmount)}</b>
              </div>
            </footer>
          </article>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/*  MAIN PAGE                                                         */
/* ================================================================== */
export default function OrderPage({ initialView = 'shop', cartOnly = false }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { cart, setCart, prescriptions, setPrescriptions } = useStore()

  /* ---------- auth ---------- */
  const [hasToken] = useState(() => Boolean(localStorage.getItem('token')))

  /* ---------- catalogue ---------- */
  const [medicines, setMedicines] = useState([])
  const [nonMedicines, setNonMedicines] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)

  /* ---------- filters ---------- */
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const initialCategory = searchParams.get('category')
  const [category, setCategory] = useState(
    () => ['medicine', 'nonmedicinal'].includes(initialCategory) ? initialCategory : 'all'
  ) // all | medicine | nonmedicinal

  /* ---------- cart ---------- */
  const [quantityDrafts, setQuantityDrafts] = useState({})
  /* ---------- offers ---------- */
  const [offers, setOffers] = useState([])

  /* ---------- addresses ---------- */
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [addressModal, setAddressModal] = useState(null) // null | {} (add) | addr (edit)

  /* ---------- checkout ---------- */
  const [paymentMode, setPaymentMode] = useState('Cash on Delivery')
  const [placing, setPlacing] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)

  /* ---------- navigation ---------- */
  const view = location.pathname === '/my-orders' || initialView === 'orders' ? 'orders' : 'shop'
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const cartOpen = cartOnly || cartDrawerOpen

  /* ---------- my orders ---------- */
  const [myOrders, setMyOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(initialView === 'orders' && hasToken)

  /* ---------- toasts ---------- */
  const [toasts, setToasts] = useState([])
  const pushToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])
  const dismissToast = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  )

  /* ================================================================== */
  /*  LOAD DATA                                                         */
  /* ================================================================== */
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [medsRes, nonRes] = await Promise.allSettled([
          api.get('/medicine'),
          api.get('/nonmedicinal'),
        ])
        if (!alive) return
        if (medsRes.status === 'fulfilled') {
          setMedicines(medsRes.value.medicines || [])
        }
        if (nonRes.status === 'fulfilled') {
          setNonMedicines(nonRes.value.items || nonRes.value.nonMedicines || [])
        }
      } finally {
        if (alive) setLoadingItems(false)
      }
    })()
    return () => { alive = false }
  }, [])

  /* Offers — try without auth so admin-only routes don't break the page */
  useEffect(() => {
    ;(async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/offers`)
        const list = Array.isArray(res.data) ? res.data : res.data.offers || []
        setOffers(list.filter((o) => o.isActive !== false))
      } catch {
        /* Offers are optional — silently skip if route is admin-only */
      }
    })()
  }, [])

  /* Load saved addresses and migrate any addresses from older local-only versions */
  useEffect(() => {
    if (!hasToken) return
    let active = true

    const loadAddresses = async () => {
      try {
        const response = await api.get('/user/addresses')
        let savedAddresses = response.addresses || []

        if (savedAddresses.length === 0) {
          let legacyAddresses = []
          try {
            legacyAddresses = JSON.parse(localStorage.getItem('deliveryAddresses') || '[]')
          } catch { /* ignore invalid legacy data */ }

          for (const legacyAddress of legacyAddresses) {
            try {
              const migrated = await api.post('/user/addresses', legacyAddress)
              savedAddresses.push(migrated.address)
              const remaining = legacyAddresses.filter((address) => address._id !== legacyAddress._id)
              if (remaining.length) {
                localStorage.setItem('deliveryAddresses', JSON.stringify(remaining))
              } else {
                localStorage.removeItem('deliveryAddresses')
              }
            } catch {
              break
            }
          }
        }

        if (active) {
          setAddresses(savedAddresses)
          setSelectedAddressId((current) => current || savedAddresses[0]?._id || '')
        }
      } catch (error) {
        if (active) pushToast(error.message || 'Failed to load saved addresses', 'error')
      }
    }

    loadAddresses()
    return () => { active = false }
  }, [hasToken, pushToast])

  /* Load orders when switching to that view */
  useEffect(() => {
    if (view !== 'orders' || !hasToken) return
    let active = true
    api
      .get('/orders/my')
      .then((d) => { if (active) setMyOrders(d.orders || []) })
      .catch(() => {})
      .finally(() => { if (active) setLoadingOrders(false) })
    return () => { active = false }
  }, [view, hasToken])

  /* ================================================================== */
  /*  CATALOGUE                                                         */
  /* ================================================================== */
  const catalogue = useMemo(() => {
    const meds = medicines.map((m) => {
      const tabletsPerStrip = Number(m.tabletsPerStrip) || 1
      const stripStock = Number(m.stock) || 0
      const storedTabletUnits = Number(m.totalMedicineQuantity) || 0
      const tabletStock = storedTabletUnits > 0 || stripStock === 0
        ? storedTabletUnits
        : stripStock * tabletsPerStrip
      return {
        itemType: 'Medicine',
        itemId: m._id,
        name: m.name,
        meta: m.manufacturer || 'Medicine',
        description: m.description || '',
        image: m.image,
        price: (Number(m.price) || 0) / tabletsPerStrip,
        stripPrice: Number(m.price) || 0,
        stock: tabletStock,
        tabletsPerStrip,
        prescriptionRequired: Boolean(m.prescriptionRequired),
        expiryDate: m.expiryDate,
      }
    })
    const nonMeds = nonMedicines.map((n) => ({
      itemType: 'NonMedicinalItem',
      itemId: n._id,
      name: n.name,
      meta: 'Non-medicinal',
      description: n.description || '',
      image: n.image,
      price: Number(n.price) || 0,
      stock: Number(n.stock) || 0,
      prescriptionRequired: false,
      expiryDate: n.expiryDate,
    }))
    return [...meds, ...nonMeds]
  }, [medicines, nonMedicines])

  const filtered = useMemo(() => {
    let list = catalogue
    if (category === 'medicine') list = list.filter((i) => i.itemType === 'Medicine')
    if (category === 'nonmedicinal') list = list.filter((i) => i.itemType === 'NonMedicinalItem')
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((i) =>
        [i.name, i.meta, i.description]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    }
    return list
  }, [catalogue, category, query])

  /* ================================================================== */
  /*  CART                                                              */
  /* ================================================================== */
  const addToCart = (item) => {
    if (item.stock <= 0) {
      pushToast(`${item.name} is out of stock`, 'error')
      return
    }
    if (item.price <= 0) {
      pushToast(`${item.name} has no price set — ask admin to update`, 'error')
      return
    }

    setCart((prev) => {
      const existing = prev.find((c) => keyOf(c) === keyOf(item))
      if (existing) {
        if (existing.quantity >= item.stock) {
          pushToast(`Only ${item.stock} of ${item.name} in stock`, 'error')
          return prev
        }
        return prev.map((c) =>
          keyOf(c) === keyOf(item) ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [{ ...item, quantity: 1 }, ...prev]
    })

    pushToast(`${item.name} added to cart`)
  }

  const setQuantity = (item, value) => {
    const parsed = Number(value)
    const next = Math.min(Math.max(1, Number.isInteger(parsed) ? parsed : 1), item.stock)
    setCart((prev) =>
      prev.map((c) => (keyOf(c) === keyOf(item) ? { ...c, quantity: next } : c))
    )
    setQuantityDrafts((previous) => {
      const nextDrafts = { ...previous }
      delete nextDrafts[keyOf(item)]
      return nextDrafts
    })
  }

  const updateQuantityDraft = (item, value) => {
    if (/^\d*$/.test(value)) {
      setQuantityDrafts((previous) => ({ ...previous, [keyOf(item)]: value }))
    }
  }

  const commitQuantityDraft = (item) => {
    const draft = quantityDrafts[keyOf(item)]
    if (draft !== undefined) setQuantity(item, draft)
  }

  const removeItem = (item) => {
    setCart((previous) => previous.filter((entry) => keyOf(entry) !== keyOf(item)))
    setQuantityDrafts((previous) => {
      const next = { ...previous }
      delete next[keyOf(item)]
      return next
    })
    setPrescriptions((previous) => {
      const next = { ...previous }
      delete next[keyOf(item)]
      return next
    })
  }

  const clearCart = () => {
    if (!window.confirm('Clear the entire cart?')) return
    setCart([])
    setQuantityDrafts({})
    setPrescriptions({})
  }

  /* ================================================================== */
  /*  TOTALS + OFFERS                                                   */
  /* ================================================================== */
  const subtotal = useMemo(
    () => Number(cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)),
    [cart]
  )

  const appliedOffer = useMemo(() => {
    if (subtotal <= 0) return null
    const matching = offers.filter((o) => {
      const min = Number(o.minAmount) || 0
      if (subtotal < min) return false
      const max = Number(o.maxAmount) || Infinity
      if (subtotal > max) return false
      return true
    })
    if (matching.length === 0) return null
    /* Best offer = highest % then highest min bracket */
    matching.sort((a, b) => {
      const d = (b.discountPercentage || 0) - (a.discountPercentage || 0)
      if (d !== 0) return d
      return (b.minAmount || 0) - (a.minAmount || 0)
    })
    return matching[0]
  }, [offers, subtotal])

  const discountPercent = Number(appliedOffer?.discountPercentage) || 0
  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2))
  const totalAmount = Math.max(subtotal - discountAmount, 0)

  const freeItemId = appliedOffer?.freeItem
    ? typeof appliedOffer.freeItem === 'string'
      ? appliedOffer.freeItem
      : appliedOffer.freeItem._id
    : null

  const freeItemDetails = useMemo(() => {
    if (!freeItemId) return null
    return catalogue.find((i) => i.itemId === freeItemId) || null
  }, [freeItemId, catalogue])

  const totalUnits = cart.reduce((s, i) => s + i.quantity, 0)

  /* ================================================================== */
  /*  PRESCRIPTIONS                                                     */
  /* ================================================================== */
  const handlePrescriptionUpload = async (item, file) => {
    const key = keyOf(item)
    setPrescriptions((p) => ({ ...p, [key]: { url: '', publicId: '', uploading: true } }))
    try {
      const { url, publicId } = await uploadPrescription(file)
      setPrescriptions((p) => ({ ...p, [key]: { url, publicId, uploading: false } }))
      pushToast('Prescription uploaded')
    } catch (err) {
      setPrescriptions((p) => ({ ...p, [key]: { url: '', publicId: '', uploading: false } }))
      pushToast(err.message, 'error')
    }
  }

  const removePrescription = (item) => {
    setPrescriptions((p) => {
      const next = { ...p }
      delete next[keyOf(item)]
      return next
    })
  }

  /* ================================================================== */
  /*  ADDRESS                                                           */
  /* ================================================================== */
  const saveAddress = async (data) => {
    try {
      const response = addressModal?._id
        ? await api.patch(`/user/addresses/${addressModal._id}`, data)
        : await api.post('/user/addresses', data)
      const savedAddress = response.address

      if (addressModal?._id) {
        setAddresses((previous) => previous.map((address) => (
          address._id === savedAddress._id ? savedAddress : address
        )))
        pushToast('Address updated')
      } else {
        setAddresses((previous) => [...previous, savedAddress])
        setSelectedAddressId(savedAddress._id)
        pushToast('Address saved to your account')
      }
      setAddressModal(null)
    } catch (error) {
      pushToast(error.message || 'Failed to save address', 'error')
    }
  }

  /* ================================================================== */
  /*  PLACE ORDER                                                       */
  /* ================================================================== */
  const placeOrder = async () => {
    if (!hasToken) {
      navigate('/login')
      return
    }
    if (cart.length === 0) return pushToast('Add at least one item to the cart', 'error')
    if (!selectedAddressId) return pushToast('Add a delivery address', 'error')

    /* All Rx items must have their own prescription image */
    const rxItems = cart.filter((i) => i.prescriptionRequired)
    const missingRx = rxItems.find((i) => !prescriptions[keyOf(i)]?.url)
    if (missingRx) {
      setCartDrawerOpen(true)
      return pushToast(`Upload prescription for ${missingRx.name}`, 'error')
    }

    /* Guard: no zero-price items */
    const zero = cart.find((i) => !i.price || i.price <= 0)
    if (zero) return pushToast(`${zero.name} has no valid price`, 'error')

    setPlacing(true)
    try {
      const payload = {
        items: cart.map((c) => ({
          itemType: c.itemType,
          itemId: c.itemId,
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.price,
          prescriptionRequired: c.prescriptionRequired,
          prescriptionImage: c.prescriptionRequired
            ? prescriptions[keyOf(c)]?.url || ''
            : '',
        })),
        paymentMode,
        deliveryAddressId: selectedAddressId,
        discountAmount,
        offerId: appliedOffer?._id || undefined,
        freeItem: freeItemId || undefined,
      }

      const res = await api.post('/orders', payload)

      setSuccessOrder(res.order)
      setCart([])
      setPrescriptions({})
      setCartDrawerOpen(false)

      /* Refresh user orders quietly */
      api.get('/orders/my').then((d) => setMyOrders(d.orders || [])).catch(() => {})
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setPlacing(false)
    }
  }

  /* ================================================================== */
  /*  RENDER — MAIN PAGE                                                */
  /* ================================================================== */
  return (
    <div className={`order-page${cartOpen ? ' is-cart-open' : ''}${cartOnly ? ' is-cart-page' : ''}`}>
      <div className="op-bg" aria-hidden="true">
        <span className="op-orb op-orb-1" />
        <span className="op-orb op-orb-2" />
        <span className="op-orb op-orb-3" />
      </div>

      <CustomerNavigation />

      {/* =============== MAIN CONTENT =============== */}
      <main className={`op-main${cartOnly ? ' op-main-hidden' : ''}`}>
        {/* ============ SHOP VIEW ============ */}
        {view === 'shop' && (
          <>
            <section className="op-filters">
              <div className="op-search">
                <Icon name="search" size={17} />
                <input
                  placeholder="Search medicines & items…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery('')} className="op-search-clear">
                    <Icon name="close" size={13} />
                  </button>
                )}
              </div>

              <div className="op-chips">
                <button
                  className={`op-chip${category === 'all' ? ' is-active' : ''}`}
                  onClick={() => setCategory('all')}
                >
                  All <span className="op-chip-count">{catalogue.length}</span>
                </button>
                <button
                  className={`op-chip${category === 'medicine' ? ' is-active' : ''}`}
                  onClick={() => setCategory('medicine')}
                >
                  <Icon name="pill" size={13} /> Medicines
                </button>
                <button
                  className={`op-chip${category === 'nonmedicinal' ? ' is-active' : ''}`}
                  onClick={() => setCategory('nonmedicinal')}
                >
                  <Icon name="box" size={13} /> Essentials
                </button>
              </div>
            </section>

            <section className="op-grid-section">
              {loadingItems ? (
                <div className="op-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="op-card op-card-skel" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="op-empty op-empty-large">
                  <span className="op-empty-icon"><Icon name="search" size={30} /></span>
                  <h3>No items match your search</h3>
                  <p>Try a different keyword or category.</p>
                </div>
              ) : (
                <div className="op-grid">
                  {filtered.map((item, i) => (
                    <div
                      key={keyOf(item)}
                      style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                    >
                      <ItemCard item={item} onAdd={addToCart} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ============ ORDERS VIEW ============ */}
        {view === 'orders' && (
          <section className="op-panel" style={{ padding: 20 }}>
            <header className="op-section-head">
              <h2>My orders</h2>
              <span>{myOrders.length}</span>
            </header>
            {!hasToken ? (
              <div className="op-empty op-empty-large">
                <span className="op-empty-icon"><Icon name="user" size={28} /></span>
                <h3>Sign in to see your orders</h3>
                <p>Your order history is saved to your account.</p>
                <Link to="/login" className="op-btn op-btn-primary">Sign in</Link>
              </div>
            ) : (
              <MyOrders orders={myOrders} loading={loadingOrders} addresses={addresses} />
            )}
          </section>
        )}
      </main>

      {/* =============== CART PANEL =============== */}
      <aside className={`op-cart-panel${cartOnly ? ' op-cart-page-panel' : ''}`}>
        <header className="op-cart-head">
          <div>
            <h2><Icon name="cart" size={17} /> Your cart</h2>
            <span className="op-cart-count">
              {cart.length} item{cart.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
            </span>
          </div>
          <button className="op-icon-btn" onClick={() => { setCartDrawerOpen(false); navigate('/shop') }}>
            <Icon name="close" size={17} />
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="op-empty">
            <span className="op-empty-icon"><Icon name="cart" size={28} /></span>
            <h3>Cart is empty</h3>
            <p>Browse the shop and click "Add" to start.</p>
          </div>
        ) : (
          <>
            <ul className="op-cart-list">
              {cart.map((item) => (
                <li key={keyOf(item)} className="op-cart-item">
                  <div className="op-cart-item-main">
                    <span className="op-cart-thumb">
                      <ProductImage src={item.image} itemType={item.itemType} />
                    </span>
                    <div className="op-cart-item-info">
                      <strong>{item.name}</strong>
                      <span>{money(item.price)} each</span>
                    </div>
                    <button
                      className="op-cart-remove"
                      onClick={() => removeItem(item)}
                      aria-label="Remove"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>

                  <div className="op-cart-item-row">
                    <div className="op-qty">
                      <button
                        onClick={() => setQuantity(item, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Icon name="minus" size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stock}
                        value={item.quantity}
                        onChange={(e) => setQuantity(item, e.target.value)}
                      />
                      <button
                        onClick={() => setQuantity(item, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                      >
                        <Icon name="plus" size={12} />
                      </button>
                    </div>
                    <span className="op-cart-line-total">
                      {money(item.price * item.quantity)}
                    </span>
                  </div>

                  {item.prescriptionRequired && (
                    <PrescriptionUpload
                      state={prescriptions[keyOf(item)]}
                      onUpload={(f) => handlePrescriptionUpload(item, f)}
                      onRemove={() => removePrescription(item)}
                    />
                  )}
                </li>
              ))}
            </ul>

            <div className="op-totals">
              <div className="op-row">
                <span>Subtotal</span>
                <b>{money(subtotal)}</b>
              </div>

              {appliedOffer && (
                <div className="op-row op-row-offer">
                  <span>
                    <Icon name="tag" size={12} /> Offer {discountPercent}% off
                  </span>
                  <b>-{money(discountAmount)}</b>
                </div>
              )}

              {freeItemDetails && (
                <div className="op-row op-row-gift">
                  <span><Icon name="spark" size={12} /> Free gift</span>
                  <b>{freeItemDetails.name}</b>
                </div>
              )}

              <div className="op-row op-row-total">
                <span>Total</span>
                <b>{money(totalAmount)}</b>
              </div>
            </div>

            <div className="op-checkout">
              {!hasToken ? (
                <div className="op-guest-checkout">
                  <strong>Sign in to complete your order</strong>
                  <span>Your cart will be waiting when you return.</span>
                  <Link to="/login" className="op-btn op-btn-primary">Sign in to checkout</Link>
                </div>
              ) : <>
              {/* ---------- Address ---------- */}
              <div className="op-checkout-block">
                <span className="op-checkout-label">
                  <Icon name="pin" size={12} /> Delivery address
                </span>

                {addresses.length === 0 ? (
                  <button
                    className="op-add-address-btn"
                    onClick={() => setAddressModal({})}
                  >
                    <Icon name="plus" size={13} /> Add address
                  </button>
                ) : (
                  <div className="op-address-options">
                    {addresses.map((a) => (
                      <button
                        key={a._id}
                        className={`op-address-opt${selectedAddressId === a._id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedAddressId(a._id)}
                      >
                        <div className="op-addr-radio" />
                        <div className="op-addr-body">
                          <strong>{a.label || 'Address'}</strong>
                          <span>
                            {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.pincode}
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      className="op-address-add-more"
                      onClick={() => setAddressModal({})}
                    >
                      <Icon name="plus" size={12} /> Add new address
                    </button>
                  </div>
                )}
              </div>

              {/* ---------- Payment ---------- */}
              <div className="op-checkout-block">
                <span className="op-checkout-label">Payment method</span>
                <div className="op-pay-options">
                  {[
                    { value: 'online', label: 'Online payment' },
                    { value: 'Cash on Delivery', label: 'Cash on delivery' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`op-pay-chip${paymentMode === value ? ' is-active' : ''}`}
                      onClick={() => setPaymentMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ---------- Place order ---------- */}
              <footer className="op-checkout-actions">
                <button className="op-btn op-btn-ghost" onClick={clearCart}>
                  Clear
                </button>
                <button
                  className="op-btn op-btn-primary op-place-order"
                  onClick={placeOrder}
                  disabled={placing}
                >
                  {placing ? (
                    <><span className="op-spinner" /> Placing…</>
                  ) : (
                    <><Icon name="check" size={16} /> Place order · {money(totalAmount)}</>
                  )}
                </button>
              </footer>
              </>}
            </div>
          </>
        )}
      </aside>

      {/* Overlay for mobile cart drawer */}
      {cartOpen && !cartOnly && (
        <div className="op-cart-scrim" onClick={() => setCartDrawerOpen(false)} />
      )}

      {/* =============== MODALS & TOASTS =============== */}
      {addressModal && (
        <AddressModal
          initial={addressModal._id ? addressModal : null}
          onSave={saveAddress}
          onClose={() => setAddressModal(null)}
        />
      )}

      {successOrder && (
        <SuccessModal
          order={successOrder}
          onClose={() => setSuccessOrder(null)}
          onViewOrders={() => {
            setSuccessOrder(null)
            setLoadingOrders(true)
            navigate('/my-orders')
          }}
        />
      )}

      <Toasts items={toasts} onDismiss={dismissToast} />
    </div>
  )
}