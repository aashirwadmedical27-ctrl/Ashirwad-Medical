import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const ORDER_STATUSES = ['Placed', 'Confirmed', 'Delivered', 'Cancelled']

const TONE_BY_STATUS = {
  placed: 'warn',
  confirmed: 'info',
  delivered: 'ok',
  cancelled: 'danger',
  pending: 'warn',
  paid: 'ok',
  failed: 'danger',
  refunded: 'info',
}

const statusTone = (s) => TONE_BY_STATUS[String(s || '').toLowerCase()] || 'warn'

/* How often to check for new orders (ms) */
const POLL_INTERVAL = 5000
/* How long to keep the "fresh" highlight on newly arrived orders (ms) */
const FRESH_HIGHLIGHT_MS = 5000

/** "just now", "12s ago", "3m ago", "2h ago" */
function relativeTime(date) {
  if (!date) return ''
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/* ------------------------------------------------------------------ */
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  chevron: <><path d="m6 9 6 6 6-6" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3.2" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
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
/*  STATUS PICKER (portal dropdown)                                    */
/* ------------------------------------------------------------------ */
function StatusPicker({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 200 })

  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const current = value || options[0]
  const tone = statusTone(current)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const MENU_WIDTH = 220
    const GUTTER = 12

    let left = rect.left
    if (left + MENU_WIDTH > window.innerWidth - GUTTER) {
      left = Math.max(GUTTER, rect.right - MENU_WIDTH)
    }

    setCoords({
      top: rect.bottom + 8,
      left,
      minWidth: Math.max(rect.width, 200),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const inMenu = menuRef.current?.contains(e.target)
      const inBtn = buttonRef.current?.contains(e.target)
      if (!inMenu && !inBtn) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onScrollOrResize = () => setOpen(false)

    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`badge badge-${tone} badge-clickable${disabled ? ' is-loading' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Click to change status"
      >
        {disabled && <span className="spinner" />}
        <span>{current}</span>
        {!disabled && <Icon name="chevron" size={12} />}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="status-menu"
          role="menu"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            minWidth: coords.minWidth,
          }}
        >
          <div className="status-menu-head">Change order status</div>
          {options.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`status-option${s === current ? ' is-active' : ''}`}
              onClick={() => {
                setOpen(false)
                if (s !== current) onChange(s)
              }}
            >
              <span className={`status-dot dot-${statusTone(s)}`} />
              <span className="status-option-label">{s}</span>
              {s === current && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  ORDERS                                                             */
/* ------------------------------------------------------------------ */
export default function Orders({ orders, loading, pushToast }) {
  const [filter, setFilter] = useState('all')
  const [localOrders, setLocalOrders] = useState(orders || [])
  const [updatingId, setUpdatingId] = useState(null)
  const [viewingOrder, setViewingOrder] = useState(null)

  /* Live polling state */
  const [polling, setPolling] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [freshIds, setFreshIds] = useState(() => new Set())
  const [, setTick] = useState(0)

  /* Keep the latest local list in a ref so the polling loop can read it
     without needing to be re-created every time orders change. */
  const latestOrdersRef = useRef(orders || [])

  /* Keep the ref in sync with the local list */
  useEffect(() => {
    latestOrdersRef.current = localOrders
  }, [localOrders])

  /* ------------------------------------------------------------------ */
  /*  LIVE POLLING                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!polling) return

    let cancelled = false
    let timer = null

    const fetchOrders = async () => {
      try {
        const data = await api.get('/admin/orders')
        if (cancelled) return

        const list = Array.isArray(data) ? data : data.orders || []
        const previousOrders = latestOrdersRef.current
        const previousIds = new Set(previousOrders.map((o) => o._id))

        const freshOrders = list.filter((order) => !previousIds.has(order._id))
        setLastUpdated(new Date())

        if (freshOrders.length > 0) {
          const mergedOrders = [...freshOrders, ...previousOrders]
          latestOrdersRef.current = mergedOrders
          setLocalOrders(mergedOrders)

          if (previousOrders.length > 0) {
            setFreshIds((current) => new Set([...current, ...freshOrders.map((order) => order._id)]))
          }
        }
      } catch {
        /* silent — we'll try again on the next tick */
      }
    }

    const loop = async () => {
      if (cancelled) return

      /* Pause polling while the browser tab is hidden */
      if (document.visibilityState !== 'hidden') {
        await fetchOrders()
      }

      if (!cancelled) {
        timer = setTimeout(loop, POLL_INTERVAL)
      }
    }

    loop()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [polling])

  /* ------------------------------------------------------------------ */
  /*  CLEAR THE "FRESH" HIGHLIGHT AFTER A FEW SECONDS                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (freshIds.size === 0) return
    const t = setTimeout(() => setFreshIds(new Set()), FRESH_HIGHLIGHT_MS)
    return () => clearTimeout(t)
  }, [freshIds])

  /* ------------------------------------------------------------------ */
  /*  REFRESH THE RELATIVE TIMESTAMP EVERY 5 SECONDS                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])

  /* ------------------------------------------------------------------ */
  /*  MANUAL REFRESH                                                     */
  /* ------------------------------------------------------------------ */
  const refreshNow = async () => {
    try {
      const data = await api.get('/admin/orders')
      const list = Array.isArray(data) ? data : data.orders || []
      setLocalOrders(list)
      latestOrdersRef.current = list
      setLastUpdated(new Date())
      pushToast?.('Orders refreshed')
    } catch (err) {
      pushToast?.(err.message, 'error')
    }
  }

  /* ------------------------------------------------------------------ */
  /*  COUNTS                                                             */
  /* ------------------------------------------------------------------ */
  const counts = useMemo(() => {
    const c = { all: localOrders.length }
    ORDER_STATUSES.forEach((s) => { c[s] = 0 })
    localOrders.forEach((o) => {
      const s = o.orderStatus || 'Placed'
      c[s] = (c[s] || 0) + 1
    })
    return c
  }, [localOrders])

  const filtered =
    filter === 'all'
      ? localOrders
      : localOrders.filter((o) => (o.orderStatus || 'Placed') === filter)

  /* ------------------------------------------------------------------ */
  /*  STATUS CHANGE                                                      */
  /* ------------------------------------------------------------------ */
  const updateStatus = async (order, nextStatus) => {
    if (!order?._id) return
    const previous = order.orderStatus || 'Placed'
    if (previous === nextStatus) return

    setUpdatingId(order._id)
    setLocalOrders((list) =>
      list.map((o) => (o._id === order._id ? { ...o, orderStatus: nextStatus } : o))
    )

    try {
      const data = await api.patch(`/orders/${order._id}/status`, {
        orderStatus: nextStatus,
      })

      if (data?.order) {
        setLocalOrders((list) =>
          list.map((o) => (o._id === order._id ? { ...o, ...data.order } : o))
        )
      }
      pushToast?.(data?.message || `Order marked ${nextStatus}`)
    } catch (err) {
      setLocalOrders((list) =>
        list.map((o) => (o._id === order._id ? { ...o, orderStatus: previous } : o))
      )
      pushToast?.(err.message, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">
          <button
            className={`chip${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All orders
            <span className="chip-count">{counts.all}</span>
          </button>

          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              className={`chip${filter === s ? ' is-active' : ''}${counts[s] === 0 ? ' is-empty' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s}
              <span className="chip-count">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="orders-meta">
          <button
            type="button"
            className={`live-toggle${polling ? ' is-on' : ''}`}
            onClick={() => setPolling((v) => !v)}
            title={polling ? 'Pause live updates' : 'Resume live updates'}
          >
            <span className="live-dot" />
            <span className="live-label">{polling ? 'Live' : 'Paused'}</span>
          </button>

          {lastUpdated && (
            <span className="live-time">
              Updated {relativeTime(lastUpdated)}
            </span>
          )}

          <span className="count-chip">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>

          <button className="btn btn-mini" onClick={refreshNow}>
            Refresh ↻
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <Skeleton rows={4} />
        ) : filtered.length === 0 ? (
          <Empty
            icon="cart"
            title={filter === 'all' ? 'No orders yet' : `No ${filter.toLowerCase()} orders`}
            text={
              filter === 'all'
                ? 'New orders will appear here automatically.'
                : 'Try another filter or clear the selection.'
            }
          />
        ) : (
          <div className="table">
            <div className="table-head orders-grid">
              <span>Order</span>
              <span>Customer</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            <div className="table-body">
              {filtered.map((o, i) => {
                const isFresh = freshIds.has(o._id)
                return (
                  <div
                    className={`table-row orders-grid order-row-clickable${isFresh ? ' order-row-fresh' : ''}`}
                    key={o._id || i}
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    onClick={(event) => {
                      if (!event.target.closest('button')) setViewingOrder(o)
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setViewingOrder(o)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for order ${String(o._id).slice(-6).toUpperCase()}`}
                    title="Click to view order items and prescriptions"
                  >
                    <span className="mono">
                      #{String(o._id || i).slice(-6).toUpperCase()}
                    </span>

                    <div className="cell-item">
                      <div>
                        <strong>
                          {o.userId?.name || o.customerName || 'Guest'}
                          {isFresh && (
                            <span className="new-badge">
                              <Icon name="spark" size={11} /> New
                            </span>
                          )}
                        </strong>
                        <span>{o.userId?.email || o.customerEmail || '—'}</span>
                      </div>
                    </div>

                    <span className="cell">{money(o.totalAmount ?? o.amount)}</span>

                    <span>
                      <StatusPicker
                        value={o.orderStatus || 'Placed'}
                        options={ORDER_STATUSES}
                        disabled={updatingId === o._id}
                        onChange={(next) => updateStatus(o, next)}
                      />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {viewingOrder && (
        <OrderDetailModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  )
}

function OrderDetailModal({ order, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const customerName = order.userId?.name || order.customerName || 'Guest'
  const address = order.deliveryAddress
  const legacyPrescriptionItems = order.items.filter((item) => item.prescriptionRequired)
  const subtotal = Number.isFinite(Number(order.subtotal))
    ? Number(order.subtotal)
    : order.items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0)
  const discount = Number(order.discountAmount) || 0
  const total = Number.isFinite(Number(order.totalAmount))
    ? Number(order.totalAmount)
    : Math.max(subtotal - discount, 0)
  const discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0

  return createPortal(
    <div className="modal-backdrop order-detail-backdrop" onClick={onClose}>
      <section
        className="modal-card order-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head order-detail-head">
          <div>
            <h3 id="order-detail-title">Order #{String(order._id).slice(-6).toUpperCase()}</h3>
            <p>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Order details'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close order details">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="order-detail-summary">
          <div><span>Customer</span><strong>{customerName}</strong><small>{order.userId?.email || '—'}</small></div>
          <div><span>Order status</span><strong>{order.orderStatus || 'Placed'}</strong><small>#{String(order._id).slice(-8).toUpperCase()}</small></div>
          <div><span>Payment</span><strong>{order.paymentMode || '—'}</strong><small>{order.paymentStatus || 'Pending'}</small></div>
          <div><span>Items</span><strong>{order.items.length} line{order.items.length === 1 ? '' : 's'}</strong><small>{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} units</small></div>
        </div>

        <section className="order-detail-section order-price-breakdown">
          <h4>Price breakdown</h4>
          <div className="order-price-row">
            <span>Items subtotal / MRP</span>
            <strong>{money(subtotal)}</strong>
          </div>
          {order.freeItem?.name && (
            <div className="order-free-item">
              <span>Offer free item</span>
              <strong>{order.freeItem.name}</strong>
              {Number(order.freeItem.price) > 0 && <small>Value {money(order.freeItem.price)} · free</small>}
            </div>
          )}
          {order.offerId && (
            <div className="order-price-row order-offer-row">
              <span>Offer applied</span>
              <strong>#{String(order.offerId).slice(-6).toUpperCase()}</strong>
            </div>
          )}
          <div className="order-price-row order-discount-row">
            <span>Discount{discount > 0 ? ` (${discountPercent.toFixed(2)}%)` : ''}</span>
            <strong>{discount > 0 ? `− ${money(discount)}` : money(0)}</strong>
          </div>
          <div className="order-price-row order-total-row">
            <span>Total payable</span>
            <strong>{money(total)}</strong>
          </div>
        </section>

        <section className="order-detail-section">
          <h4>Items ordered</h4>
          <div className="order-detail-items">
            {order.items.map((item, index) => {
              const legacyImage = order.prescriptionImage && legacyPrescriptionItems.length === 1
                ? order.prescriptionImage
                : ''
              const prescriptionImage = item.prescriptionImage || legacyImage

              return (
                <article className="order-detail-item" key={`${item.itemId}-${index}`}>
                  <span className="order-detail-item-icon">
                    <Icon name={item.itemType === 'Medicine' ? 'pill' : 'box'} size={17} />
                  </span>
                  <div className="order-detail-item-main">
                    <strong>{item.name}</strong>
                    <span>{item.itemType === 'Medicine' ? 'Medicine' : 'Non-medicinal item'} · Qty {item.quantity}</span>
                    {item.prescriptionRequired && (
                      <div className="order-prescription">
                        <b>Prescription required</b>
                        {prescriptionImage ? (
                          <a href={prescriptionImage} target="_blank" rel="noreferrer" className="order-prescription-link">
                            <img src={prescriptionImage} alt={`Prescription for ${item.name}`} />
                            <span>View prescription</span>
                          </a>
                        ) : (
                          <span className="order-prescription-missing">No prescription attached</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="order-detail-item-price">
                    <strong>{money(Number(item.unitPrice) * Number(item.quantity))}</strong>
                    <span>{money(item.unitPrice)} each</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {address && (
          <section className="order-detail-section order-delivery-address">
            <h4>Delivery address</h4>
            <strong>{address.label ? `${address.label} · ` : ''}{address.name} · {address.phone}</strong>
            <p>
              {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}
              {address.state ? `, ${address.state}` : ''} {address.pincode}
            </p>
          </section>
        )}

        <footer className="order-detail-footer">
          <span>Placed {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
          <strong>Total {money(total)}</strong>
        </footer>
      </section>
    </div>,
    document.body
  )
}