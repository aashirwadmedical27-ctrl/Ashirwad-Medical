import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
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
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const when = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const todayISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

const startOfMonthISO = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

const periodLabel = (id, groupBy) => {
  if (!id) return ''
  if (groupBy === 'month') {
    const [y, m] = id.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[Number(m) - 1]} ${y}`
  }
  if (groupBy === 'week') {
    return id.replace('-W', ' W')
  }
  return id.slice(5) // MM-DD
}

/* ------------------------------------------------------------------ */
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15v4" /><path d="M11 11v8" /><path d="M15 7v12" /><path d="M19 5v14" /></>,
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
/*  SUMMARY STRIP (Billing view)                                       */
/* ------------------------------------------------------------------ */
function SummaryStrip({ summary }) {
  const cards = [
    { label: "Today's bills", value: summary?.today?.bills ?? 0, icon: 'receipt' },
    { label: "Today's MRP", value: money(summary?.today?.totalMrp), icon: 'tag' },
    { label: "Today's collected", value: money(summary?.today?.soldAmount), icon: 'cart' },
    {
      label: "Today's discount",
      value: `${summary?.today?.discountPercent ?? 0}%`,
      icon: 'tag',
    },
  ]

  return (
    <section className="stat-grid">
      {cards.map((c, i) => (
        <article
          key={c.label}
          className="stat-card tone-indigo"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="stat-top">
            <span className="stat-icon"><Icon name={c.icon} size={20} /></span>
            <span className="stat-spark" />
          </div>
          <h3 className="stat-value">{c.value}</h3>
          <p className="stat-label">{c.label}</p>
          <span className="stat-shine" />
        </article>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  BILL DETAIL MODAL                                                  */
/* ------------------------------------------------------------------ */
function BillDetailModal({ bill, onClose, onDelete }) {
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

  const totalUnits = bill.items.reduce((s, i) => s + Number(i.quantity || 0), 0)
  const soldByName = bill.soldByName || bill.soldBy?.name || '—'

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card bill-detail-card" onClick={(e) => e.stopPropagation()}>
        <header className="bill-detail-head">
          <div className="bill-detail-title">
            <span className="bill-detail-icon">
              <Icon name="receipt" size={22} />
            </span>
            <div>
              <h3>{bill.billNumber}</h3>
              <p>{when(bill.createdAt)} · {bill.paymentMode}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>

        <section className="bill-detail-meta">
          <div className="bill-meta-card">
            <span className="bill-meta-label">Customer</span>
            <strong>{bill.customerName || 'Walk-in'}</strong>
            <small>{bill.customerPhone || 'No phone'}</small>
          </div>
          <div className="bill-meta-card">
            <span className="bill-meta-label">Items</span>
            <strong>{bill.items.length} line{bill.items.length === 1 ? '' : 's'}</strong>
            <small>{totalUnits} unit{totalUnits === 1 ? '' : 's'}</small>
          </div>
          <div className="bill-meta-card">
            <span className="bill-meta-label">Sold by</span>
            <strong>{soldByName}</strong>
            <small>Admin console</small>
          </div>
          <div className="bill-meta-card">
            <span className="bill-meta-label">Payment</span>
            <strong>{bill.paymentMode}</strong>
            <small>Offline sale</small>
          </div>
        </section>

        <section className="bill-detail-items">
          <header className="bill-detail-section-head">
            <span>Bill items</span>
            <span>{bill.items.length}</span>
          </header>
          <ul className="bill-items-list">
            {bill.items.map((it, idx) => (
              <li
                key={`${it.itemId}-${idx}`}
                className="bill-item-row"
                style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
              >
                <span className="bill-item-icon">
                  <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={16} />
                </span>
                <div className="bill-item-info">
                  <strong>{it.name}</strong>
                  <span>
                    {it.itemType === 'Medicine' ? 'Medicine' : 'Non-medicinal'}
                    {it.prescriptionRequired ? ' · Rx' : ''}
                  </span>
                </div>
                <span className="bill-item-qty">
                  {it.quantity} × {money(it.mrp)}
                </span>
                <span className="bill-item-total">{money(it.lineMrp)}</span>
              </li>
            ))}
          </ul>
        </section>

        {bill.note && (
          <div className="bill-detail-note">
            <strong>Note:</strong> {bill.note}
          </div>
        )}

        <section className="bill-detail-totals">
          <div className="bill-total-row">
            <span>Actual MRP total</span>
            <b>{money(bill.totalMrp)}</b>
          </div>
          <div className="bill-total-row">
            <span>Sold amount</span>
            <b>{money(bill.soldAmount)}</b>
          </div>
          <div className="bill-total-row highlight">
            <span>Discount given</span>
            <b>
              {money(bill.discountAmount)}{' '}
              <small>({Number(bill.discountPercent).toFixed(2)}%)</small>
            </b>
          </div>
        </section>

        <footer className="bill-detail-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button
            className="btn btn-mini danger"
            onClick={() => { onDelete(bill); onClose() }}
          >
            <Icon name="trash" size={15} /> Delete bill
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------------ */
/*  TIMELINE CHART                                                     */
/* ------------------------------------------------------------------ */
function TimelineChart({ data, groupBy }) {
  const max = Math.max(...data.map((d) => d.soldAmount), 1)

  return (
    <div className="stats-timeline">
      <div className="stats-timeline-bars">
        {data.map((d, i) => {
          const pct = (d.soldAmount / max) * 100
          return (
            <div
              key={d.period}
              className="stats-bar-wrap"
              title={`${periodLabel(d.period, groupBy)}\nSold: ${money(d.soldAmount)}\nMRP: ${money(d.totalMrp)}\nBills: ${d.bills}`}
            >
              <div
                className="stats-bar"
                style={{ height: `${Math.max(pct, 3)}%`, animationDelay: `${i * 35}ms` }}
              >
                <i />
              </div>
            </div>
          )
        })}
      </div>
      <div className="stats-timeline-labels">
        {data.map((d) => (
          <span key={d.period}>{periodLabel(d.period, groupBy)}</span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  STATISTICS PANEL                                                   */
/* ------------------------------------------------------------------ */
function StatsPanel({ medicines, nonMedicines, pushToast }) {
  const [from, setFrom] = useState(startOfMonthISO)
  const [to, setTo] = useState(todayISO)
  const [groupBy, setGroupBy] = useState('day')
  const [itemFilter, setItemFilter] = useState(null)
  const [itemSearch, setItemSearch] = useState('')
  const [itemMenuOpen, setItemMenuOpen] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  /* ---------- item catalogue ---------- */
  const catalogue = useMemo(
    () => [
      ...medicines.map((m) => ({
        itemId: m._id,
        itemType: 'Medicine',
        name: m.name,
      })),
      ...nonMedicines.map((n) => ({
        itemId: n._id,
        itemType: 'NonMedicinalItem',
        name: n.name,
      })),
    ],
    [medicines, nonMedicines]
  )

  const itemResults = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const filtered = q
      ? catalogue.filter((i) => i.name.toLowerCase().includes(q))
      : catalogue
    return filtered.slice(0, 8)
  }, [catalogue, itemSearch])

  /* ---------- fetch ---------- */
  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const params = { from, to, groupBy }
      if (itemFilter) params.itemId = itemFilter.itemId
      const data = await api.get('/offline-sales/stats', { params })
      setStats(data.stats)
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [from, to, groupBy, itemFilter, pushToast])

  useEffect(() => { loadStats() }, [loadStats])

  const totals = stats?.totals || { bills: 0, totalMrp: 0, soldAmount: 0, discountAmount: 0 }
  const growth = stats?.growth
  const timeline = stats?.timeline || []
  const topItems = stats?.topItems || []

  const handleFrom = (v) => {
    setFrom(v)
    if (v && to && new Date(v) > new Date(to)) setTo(v)
  }
  const handleTo = (v) => {
    setTo(v)
    if (v && from && new Date(v) < new Date(from)) setFrom(v)
  }

  const growthVisible =
    growth && growth.previous.soldAmount > 0 && typeof growth.soldGrowth === 'number'

  /* ---------- render ---------- */
  return (
    <div className="stack">
      {/* ============ FILTERS ============ */}
      <div className="panel stats-filter-panel">
        <div className="stats-filters">
          <label className="field">
            <span className="field-label">From</span>
            <input
              type="date"
              className="input"
              value={from}
              max={to}
              onChange={(e) => handleFrom(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">To</span>
            <input
              type="date"
              className="input"
              value={to}
              min={from}
              onChange={(e) => handleTo(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Group by</span>
            <select
              className="input"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>

          {/* ---- item filter ---- */}
          <div className="field stats-item-filter">
            <span className="field-label">Specific item</span>

            {itemFilter ? (
              <div className="stats-item-chip">
                <Icon name={itemFilter.itemType === 'Medicine' ? 'pill' : 'box'} size={13} />
                <span>{itemFilter.name}</span>
                <button
                  type="button"
                  onClick={() => setItemFilter(null)}
                  aria-label="Clear item filter"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ) : (
              <div className="search" style={{ minWidth: 0 }}>
                <Icon name="search" size={16} />
                <input
                  placeholder="All items"
                  value={itemSearch}
                  onChange={(e) => { setItemSearch(e.target.value); setItemMenuOpen(true) }}
                  onFocus={() => setItemMenuOpen(true)}
                  onBlur={() => setTimeout(() => setItemMenuOpen(false), 150)}
                />
                {itemSearch && (
                  <button
                    className="search-clear"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setItemSearch('')}
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </div>
            )}

            {itemMenuOpen && !itemFilter && (
              <div className="stats-item-menu">
                {itemResults.length === 0 ? (
                  <p className="stats-item-empty">No matching item</p>
                ) : (
                  itemResults.map((it) => (
                    <button
                      key={it.itemId}
                      type="button"
                      className="stats-item-option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setItemFilter(it)
                        setItemMenuOpen(false)
                        setItemSearch('')
                      }}
                    >
                      <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={13} />
                      <span>{it.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ SUMMARY CARDS ============ */}
      <section className="stat-grid">
        <article className="stat-card tone-indigo">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="receipt" size={20} /></span>
            <span className="stat-spark" />
          </div>
          <h3 className="stat-value">{totals.bills}</h3>
          <p className="stat-label">Bills</p>
          <span className="stat-shine" />
        </article>

        <article className="stat-card tone-cyan">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="tag" size={20} /></span>
            <span className="stat-spark" />
          </div>
          <h3 className="stat-value">{money(totals.totalMrp)}</h3>
          <p className="stat-label">MRP value sold</p>
          <span className="stat-shine" />
        </article>

        <article className="stat-card tone-emerald">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="cart" size={20} /></span>
            <span className="stat-spark" />
          </div>
          <h3 className="stat-value">{money(totals.soldAmount)}</h3>
          <p className="stat-label">Revenue collected</p>
          <span className="stat-shine" />
        </article>

        <article className="stat-card tone-violet">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="tag" size={20} /></span>
            <span className="stat-spark" />
          </div>
          <h3 className="stat-value">{money(totals.discountAmount)}</h3>
          <p className="stat-label">Discount given (loss)</p>
          <span className="stat-shine" />
        </article>
      </section>

      {/* ============ GROWTH BANNER ============ */}
      {growthVisible && (
        <div className={`growth-banner ${growth.soldGrowth >= 0 ? 'up' : 'down'}`}>
          <span className="growth-arrow">{growth.soldGrowth >= 0 ? '↑' : '↓'}</span>
          <div className="growth-text">
            <strong>
              {Math.abs(growth.soldGrowth).toFixed(2)}%{' '}
              {growth.soldGrowth >= 0 ? 'growth' : 'decline'} in revenue
            </strong>
            <span>
              vs previous period ({money(growth.previous.soldAmount)} →{' '}
              {money(growth.current.soldAmount)})
              {typeof growth.billGrowth === 'number' && (
                <>
                  {' · '}
                  {growth.billGrowth >= 0 ? '+' : ''}
                  {growth.billGrowth.toFixed(1)}% bills
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* ============ TIMELINE ============ */}
      <div className="panel">
        <header className="panel-head">
          <h3>Sales over time</h3>
          <span className="count-chip">
            {timeline.length} {groupBy}{timeline.length === 1 ? '' : 's'}
          </span>
        </header>

        {loading ? (
          <Skeleton rows={2} />
        ) : timeline.length === 0 ? (
          <Empty
            icon="tag"
            title="No sales"
            text="Try a different date range or clear the item filter."
          />
        ) : (
          <TimelineChart data={timeline} groupBy={groupBy} />
        )}
      </div>

      {/* ============ TOP ITEMS ============ */}
      <div className="panel">
        <header className="panel-head">
          <h3>
            {itemFilter ? `Sales of "${itemFilter.name}"` : 'Top selling items'}
          </h3>
          <span className="count-chip">{topItems.length}</span>
        </header>

        {loading ? (
          <Skeleton rows={4} />
        ) : topItems.length === 0 ? (
          <Empty icon="pill" title="No items sold" text="No sales in the selected period." />
        ) : (
          <div className="stats-top-list">
            {topItems.map((it, i) => {
              const maxMrp = Math.max(...topItems.map((t) => t.totalMrp), 1)
              const pct = (it.totalMrp / maxMrp) * 100
              return (
                <div key={`${it.itemType}-${it.itemId}`} className="stats-top-row">
                  <span className="stats-top-rank">#{i + 1}</span>
                  <span className="stats-top-icon">
                    <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={15} />
                  </span>
                  <div className="stats-top-main">
                    <strong>{it.name}</strong>
                    <span>
                      {it.quantity} unit{it.quantity === 1 ? '' : 's'} · {it.bills} bill
                      {it.bills === 1 ? '' : 's'}
                    </span>
                    <div className="stats-top-bar-wrap">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="stats-top-value">{money(it.totalMrp)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */
export default function OfflineBilling({
  medicines = [],
  nonMedicines = [],
  pushToast = () => {},
  reload,
}) {
  const [view, setView] = useState('billing')

  /* ---------- bill builder state ---------- */
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [quantityDrafts, setQuantityDrafts] = useState({})
  const [soldAmount, setSoldAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const saveBillLockRef = useRef(false)

  /* ---------- bill history state ---------- */
  const [bills, setBills] = useState([])
  const [summary, setSummary] = useState(null)
  const [billsLoading, setBillsLoading] = useState(true)
  const [viewingBill, setViewingBill] = useState(null)

  /* ---------- catalogue ---------- */
  const catalogue = useMemo(
    () => [
      ...medicines.map((m) => ({
        itemType: 'Medicine',
        itemId: m._id,
        name: m.name,
        meta: `${m.manufacturer || 'Medicine'} · ${Number(m.tabletsPerStrip) || 1} tablets per strip`,
        mrp: (Number(m.price) || 0) / (Number(m.tabletsPerStrip) || 1),
        stock: Number(m.totalMedicineQuantity) > 0 || Number(m.stock || 0) === 0
          ? Number(m.totalMedicineQuantity) || 0
          : Number(m.stock || 0) * (Number(m.tabletsPerStrip) || 1),
        tabletsPerStrip: Number(m.tabletsPerStrip) || 1,
        image: m.image,
        prescriptionRequired: Boolean(m.prescriptionRequired),
      })),
      ...nonMedicines.map((n) => ({
        itemType: 'NonMedicinalItem',
        itemId: n._id,
        name: n.name,
        meta: 'Non-medicinal',
        mrp: Number(n.price) || 0,
        stock: Number(n.stock) || 0,
        image: n.image,
        prescriptionRequired: false,
      })),
    ],
    [medicines, nonMedicines]
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return catalogue
      .filter((it) =>
        [it.name, it.meta].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [catalogue, query])

  /* ---------- cart ops ---------- */
  const keyOf = (it) => `${it.itemType}:${it.itemId}`

  const inCart = useCallback(
    (it) => cart.find((c) => keyOf(c) === keyOf(it)),
    [cart]
  )

    const addToCart = (it) => {
    if (!it.stock) {
      pushToast(`${it.name} is out of stock`, 'error')
      return
    }
    setCart((prev) => {
      const existing = prev.find((c) => keyOf(c) === keyOf(it))
      if (existing) {
        if (existing.quantity >= it.stock) {
          pushToast(`Only ${it.stock} of ${it.name} in stock`, 'error')
          return prev
        }
        return prev.map((c) =>
          keyOf(c) === keyOf(it) ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      // ✅ New item is prepended so the most recently added one is always on top
      return [{ ...it, quantity: 1 }, ...prev]
    })
    setQuery('')
  }
  
  const setQuantity = (it, value) => {
    const next = Math.max(1, Math.min(Number(value) || 1, it.stock))
    const itemKey = keyOf(it)
    setQuantityDrafts((drafts) => {
      const remainingDrafts = { ...drafts }
      delete remainingDrafts[itemKey]
      return remainingDrafts
    })
    setCart((prev) =>
      prev.map((c) => (keyOf(c) === itemKey ? { ...c, quantity: next } : c))
    )
  }

  const handleQuantityInput = (it, value) => {
    const itemKey = keyOf(it)
    if (value !== '' && !/^\d+$/.test(value)) return

    setQuantityDrafts((drafts) => ({ ...drafts, [itemKey]: value }))
    if (value === '') return

    const next = Math.max(1, Math.min(Number(value), it.stock))
    setCart((prev) =>
      prev.map((c) => (keyOf(c) === itemKey ? { ...c, quantity: next } : c))
    )
  }

  const finishQuantityInput = (it) => {
    const itemKey = keyOf(it)
    const draft = quantityDrafts[itemKey]
    setQuantity(it, draft === '' ? it.quantity : draft)
  }

  const removeItem = (it) => {
    const itemKey = keyOf(it)
    setQuantityDrafts((drafts) => {
      const remainingDrafts = { ...drafts }
      delete remainingDrafts[itemKey]
      return remainingDrafts
    })
    setCart((prev) => prev.filter((c) => keyOf(c) !== itemKey))
  }

  const resetBill = () => {
    setCart([])
    setQuantityDrafts({})
    setSoldAmount('')
    setCustomerName('')
    setCustomerPhone('')
    setNote('')
    setPaymentMode('Cash')
    setQuery('')
  }

  /* ---------- totals ---------- */
  const totalMrp = useMemo(
    () => Number(cart.reduce((s, i) => s + i.mrp * i.quantity, 0).toFixed(2)),
    [cart]
  )

  const soldNumber = Number(soldAmount)
  const hasSold = soldAmount !== '' && Number.isFinite(soldNumber) && soldNumber >= 0

  const discountAmount = hasSold ? Number((totalMrp - soldNumber).toFixed(2)) : 0
  const discountPercent =
    totalMrp > 0 && hasSold ? Number(((discountAmount / totalMrp) * 100).toFixed(2)) : 0
  const settlementPercent =
    totalMrp > 0 && hasSold ? Number(((soldNumber / totalMrp) * 100).toFixed(2)) : 0

  const totalUnits = cart.reduce((s, i) => s + i.quantity, 0)

  /* ---------- load bills ---------- */
  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        api.get('/offline-sales', { params: { limit: 25 } }),
        api.get('/offline-sales/summary'),
      ])
      if (listRes.status === 'fulfilled') setBills(listRes.value.sales || [])
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.summary || null)
    } finally {
      setBillsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  /* ---------- save bill ---------- */
  const saveBill = async () => {
    if (saveBillLockRef.current) return
    if (cart.length === 0) return pushToast('Add at least one item to the bill', 'error')
    if (!hasSold) return pushToast('Enter the final sold amount', 'error')

    saveBillLockRef.current = true
    setSaving(true)
    try {
      const data = await api.post('/offline-sales', {
        items: cart.map((c) => ({
          itemType: c.itemType,
          itemId: c.itemId,
          name: c.name,
          mrp: c.mrp,
          quantity: c.quantity,
          prescriptionRequired: c.prescriptionRequired,
        })),
        soldAmount: soldNumber,
        paymentMode,
        customerName,
        customerPhone,
        note,
      })

      pushToast(data.message || 'Bill saved successfully')
      resetBill()
      await Promise.all([loadBills(), Promise.resolve(reload?.())])
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      saveBillLockRef.current = false
      setSaving(false)
    }
  }

  const deleteBill = async (bill) => {
    if (!window.confirm(`Delete bill ${bill.billNumber}? Stock will be restored.`)) return
    try {
      const data = await api.delete(`/offline-sales/${bill._id}`)
      pushToast(data.message || 'Bill deleted')
      await Promise.all([loadBills(), Promise.resolve(reload?.())])
    } catch (err) {
      pushToast(err.message, 'error')
    }
  }

  /* ---------- render ---------- */
  return (
    <div className="stack">
      {/* ============ VIEW SWITCH ============ */}
      <div className="billing-view-switch">
        <button
          type="button"
          className={view === 'billing' ? 'active' : ''}
          onClick={() => setView('billing')}
        >
          <Icon name="receipt" size={16} /> Billing
        </button>
        <button
          type="button"
          className={view === 'stats' ? 'active' : ''}
          onClick={() => setView('stats')}
        >
          <Icon name="chart" size={16} /> Statistics
        </button>
      </div>

      {/* ============ BILLING VIEW ============ */}
      {view === 'billing' && (
        <>
          <SummaryStrip summary={summary} />

          <section className="billing-grid">
            <div className="panel">
              <header className="panel-head">
                <h3>New shop bill</h3>
                <span className="count-chip">
                  {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                </span>
              </header>

              <div className="billing-search">
                <div className="search">
                  <Icon name="search" size={18} />
                  <input
                    placeholder="Search medicine or item to bill…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && results[0]) {
                        e.preventDefault()
                        addToCart(results[0])
                      }
                    }}
                  />
                  {query && (
                    <button className="search-clear" onClick={() => setQuery('')}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>

                {query.trim() && (
                  <div className="billing-results">
                    {results.length === 0 ? (
                      <Empty
                        icon="search"
                        title="No match"
                        text="Nothing in inventory matches that search."
                      />
                    ) : (
                      results.map((it) => {
                        const added = inCart(it)
                        return (
                          <button
                            type="button"
                            key={keyOf(it)}
                            className="billing-result"
                            onClick={() => addToCart(it)}
                            disabled={!it.stock}
                          >
                            <span className="thumb">
                              {it.image ? (
                                <img src={it.image} alt="" />
                              ) : (
                                <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={18} />
                              )}
                            </span>
                            <span className="r-main">
                              <strong>{it.name}</strong>
                              <span>
                                {it.meta} · {it.stock}{' '}
                                {it.itemType === 'Medicine' ? 'tablets' : 'units'} in stock
                                {added ? ` · ${added.quantity} in bill` : ''}
                              </span>
                            </span>
                            <span className="r-price">
                              {money(it.mrp)}
                              {it.itemType === 'Medicine' ? ' / tablet' : ''}
                            </span>
                            <Icon name="plus" size={16} />
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {cart.length === 0 ? (
                <Empty
                  icon="receipt"
                  title="Bill is empty"
                  text="Search for a medicine above and press Enter or click it to add."
                />
              ) : (
                <div className="table billing-cart-table">
                  <div className="table-head">
                    <span>Item</span>
                    <span>MRP / unit</span>
                    <span>Qty (units)</span>
                    <span>Line total</span>
                    <span />
                  </div>
                  <div className="table-body">
                    {cart.map((it, i) => (
                      <div
                        className="table-row"
                        key={keyOf(it)}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      >
                        <div className="cell-item">
                          <span className="thumb">
                            {it.image ? (
                              <img src={it.image} alt="" />
                            ) : (
                              <Icon name={it.itemType === 'Medicine' ? 'pill' : 'box'} size={18} />
                            )}
                          </span>
                          <div>
                            <strong>{it.name}</strong>
                            <span>{it.meta}</span>
                          </div>
                        </div>

                        <span className="cell">
                          {money(it.mrp)}
                          {it.itemType === 'Medicine' ? ' / tablet' : ''}
                        </span>

                        <div className="billing-qty">
                          <button
                            type="button"
                            onClick={() => setQuantity(it, it.quantity - 1)}
                            aria-label="Decrease"
                          >
                            <Icon name="minus" size={14} />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            max={it.stock}
                            value={quantityDrafts[keyOf(it)] ?? String(it.quantity)}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => handleQuantityInput(it, e.target.value)}
                            onBlur={() => finishQuantityInput(it)}
                            aria-label={`Quantity of ${it.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => setQuantity(it, it.quantity + 1)}
                            aria-label="Increase"
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>

                        <span className="cell">{money(it.mrp * it.quantity)}</span>

                        <div className="cell-actions">
                          <button
                            className="btn-icon-sm danger"
                            onClick={() => removeItem(it)}
                            aria-label="Remove"
                            title="Remove from bill"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="panel billing-summary">
              <header className="panel-head">
                <h3>Bill settlement</h3>
                <span className="billing-badge">Offline</span>
              </header>

              <div className="billing-lines">
                <div className="billing-line">
                  <span>Items</span>
                  <b>{cart.length}</b>
                </div>
                <div className="billing-line">
                  <span>Total quantity</span>
                  <b>{totalUnits}</b>
                </div>
                <div className="billing-line">
                  <span>Actual MRP total</span>
                  <b>{money(totalMrp)}</b>
                </div>
              </div>

              <label className="field field-full">
                <span className="field-label">Final sold amount (₹)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter the amount collected after adding all medicines"
                  value={soldAmount}
                  onChange={(e) => setSoldAmount(e.target.value)}
                />
                <span className="field-hint">
                  Enter the <b>total</b> amount charged to the customer — not the per-medicine price.
                </span>
              </label>

              <div className="billing-total">
                <span>Discount</span>
                <b>
                  {money(discountAmount)}{' '}
                  <small style={{ opacity: 0.6, fontWeight: 500 }}>
                    ({discountPercent.toFixed(2)}%)
                  </small>
                </b>
              </div>

              <div className="billing-bar">
                <i style={{ width: `${Math.min(Math.max(settlementPercent, 0), 100)}%` }} />
              </div>
              <p className="attention-hint">
                <Icon name="tag" size={12} />
                <span>
                  Customer pays <b>{settlementPercent.toFixed(2)}%</b> of MRP
                  <span className="hint-sep">·</span>
                  Saved as <b>{discountPercent.toFixed(2)}%</b> discount
                </span>
              </p>

              <div className="billing-meta" style={{ marginTop: 12 }}>
                <label className="field">
                  <span className="field-label">Payment mode</span>
                  <select
                    className="input"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Other</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Customer phone</span>
                  <input
                    className="input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <label className="field field-full" style={{ marginTop: 10 }}>
                <span className="field-label">Customer name</span>
                <input
                  className="input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                />
              </label>

              <label className="field field-full" style={{ marginTop: 10 }}>
                <span className="field-label">Note</span>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional — e.g. walk-in customer"
                />
              </label>

              <footer className="form-foot" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetBill}
                  disabled={saving}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveBill}
                  disabled={saving || cart.length === 0 || !hasSold}
                >
                  {saving ? <span className="spinner" /> : <Icon name="check" size={18} />}
                  {saving ? 'Saving…' : 'Save bill'}
                </button>
              </footer>
            </div>
          </section>

          <div className="panel">
            <header className="panel-head">
              <h3>Recent offline bills</h3>
              <button className="link-btn" onClick={loadBills}>Refresh ↻</button>
            </header>

            {billsLoading ? (
              <Skeleton rows={4} />
            ) : bills.length === 0 ? (
              <Empty
                icon="receipt"
                title="No offline bills yet"
                text="The first bill you save will appear here."
              />
            ) : (
              <div className="table billing-history-table">
                <div className="table-head">
                  <span>Bill</span>
                  <span>MRP</span>
                  <span>Sold</span>
                  <span>Discount %</span>
                  <span />
                </div>
                <div className="table-body">
                  {bills.map((b, i) => (
                    <div
                      className="table-row clickable"
                      key={b._id}
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      onClick={() => setViewingBill(b)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setViewingBill(b)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      title="Click to view bill details"
                      aria-label={`View bill ${b.billNumber}`}
                    >
                      <div className="cell-item">
                        <span className="thumb">
                          <Icon name="receipt" size={18} />
                        </span>
                        <div>
                          <strong>{b.billNumber}</strong>
                          <span>
                            {when(b.createdAt)} · {b.items.length} item
                            {b.items.length === 1 ? '' : 's'} · {b.paymentMode}
                            {b.customerName ? ` · ${b.customerName}` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="cell">{money(b.totalMrp)}</span>
                      <span className="cell">{money(b.soldAmount)}</span>
                      <span className="cell">
                        {Number(b.discountPercent).toFixed(2)}%
                        {b.discountAmount > 0 && (
                          <small style={{ opacity: 0.55 }}> · {money(b.discountAmount)}</small>
                        )}
                      </span>
                      <div className="cell-actions">
                        <span className="row-chevron" aria-hidden="true">
                          <Icon name="chevron" size={14} />
                        </span>
                        <button
                          className="btn-icon-sm danger"
                          onClick={(e) => { e.stopPropagation(); deleteBill(b) }}
                          title="Delete bill"
                          aria-label="Delete bill"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ STATS VIEW ============ */}
      {view === 'stats' && (
        <StatsPanel
          medicines={medicines}
          nonMedicines={nonMedicines}
          pushToast={pushToast}
        />
      )}

      {/* ============ BILL DETAIL MODAL ============ */}
      {viewingBill && (
        <BillDetailModal
          bill={viewingBill}
          onClose={() => setViewingBill(null)}
          onDelete={deleteBill}
        />
      )}
    </div>
  )
}