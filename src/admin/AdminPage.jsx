import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import './admin.css'

import Dashboard from './modules/Dashboard'
import AddItems from './modules/AddItems'
import UpdateItems from './modules/UpdateItems'
import AddOffer from './modules/AddOffer'
import Orders from './modules/Orders'
import OfflineBilling from './modules/OfflineBilling'

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
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3.2" /></>,
  chevron: <><path d="m6 9 6 6 6-6" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  receipt: <><path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  cake: <><path d="M3 21h18" /><path d="M5 21V10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11" /><path d="M9 7V4" /><path d="M15 7V4" /><circle cx="9" cy="3" r="1" /><circle cx="15" cy="3" r="1" /><path d="M5 15h14" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
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
/*  LOCAL TOAST STACK                                                  */
/* ------------------------------------------------------------------ */
function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            <Icon
              name={t.type === 'error' ? 'alert' : t.type === 'info' ? 'spark' : 'check'}
              size={18}
            />
          </span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)}>
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NOTIFICATION BELL (Birthdays) — portal'd to body                  */
/* ------------------------------------------------------------------ */
function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [daysAhead, setDaysAhead] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState({ top: 100, right: 16 })
  const [selectedBirthday, setSelectedBirthday] = useState(null)

  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const cacheRef = useRef({}) // { [days]: response } — cleared at midnight

  /* ---------- load (cached per tab window) ---------- */
  const load = useCallback(async (force = false) => {
    if (!force && cacheRef.current[daysAhead]) {
      setData(cacheRef.current[daysAhead])
      return
    }
    setLoading(true)
    try {
      const res = await api.get('/birthdays', { params: { days: daysAhead } })
      cacheRef.current[daysAhead] = res
      setData(res)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [daysAhead])

  /* Initial load + on tab change (cache respected) */
  useEffect(() => { load() }, [load])

  /* ---------- Refresh at 12:00 AM only (no polling) ---------- */
  useEffect(() => {
    let timer
    const scheduleNextMidnight = () => {
      const now = new Date()
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
      )
      const delay = nextMidnight.getTime() - now.getTime()

      timer = setTimeout(() => {
        cacheRef.current = {}         // new day → invalidate cache
        load(true)                    // force refetch current window
        scheduleNextMidnight()        // chain to next midnight
      }, delay)
    }
    scheduleNextMidnight()
    return () => clearTimeout(timer)
  }, [load])

  /* ---------- anchor position tracking ---------- */
  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 12,
      right: Math.max(12, window.innerWidth - rect.right),
    })
  }, [])

  const toggleOpen = () => {
    if (!open) updatePos()
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = () => updatePos()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open, updatePos])

  /* ---------- Reset detail view when tab changes or panel closes ---------- */
  useEffect(() => {
    setSelectedBirthday(null)
  }, [daysAhead, open])

  /* ---------- Outside click ---------- */
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  /* ---------- Escape (back first, then close) ---------- */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (selectedBirthday) setSelectedBirthday(null)
      else setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedBirthday])

  const todayCount = data?.todayCount || 0
  const hasNotif = todayCount > 0
  const birthdays = data?.birthdays || []

  /* ------------------------------------------------------------------ */
  /*  DETAIL VIEW                                                        */
  /* ------------------------------------------------------------------ */
  const renderDetail = (b) => {
    const initials = (b.name || '?')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()

    const dob = b.dateOfBirth ? new Date(b.dateOfBirth) : null
    const dobValid = dob && !Number.isNaN(dob.getTime())

    const dobFull = dobValid
      ? dob.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not set'

    const dobMonthDay = dobValid
      ? dob.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
      : '—'

    return (
      <div className="notif-detail">
        <div className="notif-detail-hero">
          <span className="notif-detail-avatar">{initials}</span>
          <h3>{b.name || 'Unnamed user'}</h3>

          {b.role && (
            <span className={`notif-detail-role${b.role === 'admin' ? ' is-admin' : ''}`}>
              {b.role}
            </span>
          )}

          {b.isToday ? (
            <span className="notif-detail-badge today">
              🎂 Birthday today · Turns {b.turningAge}
            </span>
          ) : (
            <span className="notif-detail-badge soon">
              Turns {b.turningAge} in {b.daysAway} day{b.daysAway === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <ul className="notif-detail-info">
          <li>
            <span className="notif-detail-icon"><Icon name="mail" size={14} /></span>
            <div>
              <small>Email</small>
              <strong title={b.email || 'Not set'}>{b.email || '—'}</strong>
            </div>
          </li>
          <li>
            <span className="notif-detail-icon"><Icon name="phone" size={14} /></span>
            <div>
              <small>Phone</small>
              <strong title={b.phone || 'Not set'}>{b.phone || '—'}</strong>
            </div>
          </li>
          <li>
            <span className="notif-detail-icon"><Icon name="cake" size={14} /></span>
            <div>
              <small>Date of birth</small>
              <strong>{dobFull}</strong>
            </div>
          </li>
          <li>
            <span className="notif-detail-icon"><Icon name="calendar" size={14} /></span>
            <div>
              <small>Birthday</small>
              <strong>{dobMonthDay} · Turns {b.turningAge}</strong>
            </div>
          </li>
        </ul>

        <div className="notif-detail-actions">
          {b.phone && (
            <a className="notif-action-btn call" href={`tel:${b.phone}`}>
              <Icon name="phone" size={13} /> Call
            </a>
          )}
          {b.email && (
            <a
              className="notif-action-btn mail"
              href={`mailto:${b.email}?subject=${encodeURIComponent(
                `Happy Birthday, ${b.name || ''}! 🎂`
              )}&body=${encodeURIComponent(
                'Wishing you a wonderful birthday and a fantastic year ahead!\n\n— Team MediCare'
              )}`}
            >
              <Icon name="mail" size={13} /> Send wish
            </a>
          )}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /*  PANEL (portal target)                                              */
  /* ------------------------------------------------------------------ */
  const panel = open ? (
    <div
      ref={panelRef}
      className="notif-panel"
      style={{
        '--notif-top': `${pos.top}px`,
        '--notif-right': `${pos.right}px`,
      }}
    >
      {selectedBirthday ? (
        <>
          <header className="notif-head">
            <button
              type="button"
              className="notif-back-btn"
              onClick={() => setSelectedBirthday(null)}
              aria-label="Back to list"
              title="Back"
            >
              <Icon name="arrowLeft" size={16} />
            </button>
            <div className="notif-head-text">
              <h3>Customer details</h3>
              <p>Birthday information</p>
            </div>
            <button
              type="button"
              className="notif-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <Icon name="close" size={14} />
            </button>
          </header>

          <div className="notif-body notif-body-detail">
            {renderDetail(selectedBirthday)}
          </div>
        </>
      ) : (
        <>
          <header className="notif-head">
            <div className="notif-head-text">
              <h3>
                <span className="notif-head-icon"><Icon name="cake" size={14} /></span>
                Birthdays
              </h3>
              <p>
                {todayCount} today · {data?.count || 0} in {daysAhead} day{daysAhead === 1 ? '' : 's'}
              </p>
            </div>
            <button
              className="notif-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <Icon name="close" size={14} />
            </button>
          </header>

          <div className="notif-tabs" role="tablist">
            {[
              { days: 0, label: 'Today' },
              { days: 7, label: '7 days' },
              { days: 30, label: '30 days' },
            ].map((t) => (
              <button
                key={t.days}
                type="button"
                className={daysAhead === t.days ? 'active' : ''}
                onClick={() => setDaysAhead(t.days)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="notif-body">
            {loading ? (
              <div className="notif-loading">
                <span className="spinner" />
                <span>Checking birthdays…</span>
              </div>
            ) : birthdays.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon">
                  <Icon name="cake" size={26} />
                </span>
                <h4>
                  {daysAhead === 0
                    ? 'No birthdays today'
                    : `No birthdays in the next ${daysAhead} days`}
                </h4>
                <p>You'll see them here when someone's big day is coming up 🎂</p>
              </div>
            ) : (
              <ul className="notif-list">
                {birthdays.map((b) => {
                  const initials = (b.name || '?')
                    .split(' ')
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <li
                      key={b._id}
                      className={`notif-item${b.isToday ? ' is-today' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBirthday(b)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedBirthday(b)
                        }
                      }}
                      aria-label={`View details for ${b.name}`}
                      title="View customer details"
                    >
                      <span className="notif-avatar">{initials}</span>
                      <div className="notif-info">
                        <strong>{b.name}</strong>
                        <span>
                          {b.isToday ? (
                            <><b>🎂 Turns {b.turningAge} today!</b></>
                          ) : (
                            <>
                              Turns {b.turningAge} in{' '}
                              <b>{b.daysAway} day{b.daysAway === 1 ? '' : 's'}</b>
                            </>
                          )}
                        </span>
                      </div>
                      {b.role === 'admin' && (
                        <span className="notif-role">Admin</span>
                      )}
                      {b.isToday && (
                        <span className="notif-cake" aria-hidden="true">🎂</span>
                      )}
                      <span className="notif-item-chevron" aria-hidden="true">
                        <Icon name="chevron" size={12} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <footer className="notif-foot">
            <span>
              <Icon name="bell" size={11} /> Refreshes at midnight
            </span>
          </footer>
        </>
      )}
    </div>
  ) : null

  return (
    <>
      <div className="notif-wrap">
        <button
          ref={btnRef}
          type="button"
          className={`notif-btn${hasNotif ? ' has-notif' : ''}${open ? ' is-open' : ''}`}
          onClick={toggleOpen}
          aria-label="Birthday notifications"
          title={hasNotif ? `${todayCount} birthday${todayCount === 1 ? '' : 's'} today` : 'Birthdays'}
        >
          <Icon name="bell" size={19} />
          {hasNotif && (
            <>
              <span className="notif-badge">{todayCount > 9 ? '9+' : todayCount}</span>
              <span className="notif-pulse" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {panel && createPortal(panel, document.body)}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  NAV                                                                */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: 'dashboard', label: 'Dashboard',        icon: 'dashboard', sub: 'Overview of your pharmacy at a glance' },
  { id: 'add',       label: 'Add Items',        icon: 'plus',      sub: 'Upload new medicines & non-medicinal products' },
  { id: 'update',    label: 'Update Items',     icon: 'edit',      sub: 'Edit price, stock and details of existing items' },
  { id: 'billing',   label: 'Offline Billing',  icon: 'receipt',   sub: 'Bill walk-in shop customers and record offline sales' },
  { id: 'offer',     label: 'Add Offer',        icon: 'tag',       sub: 'Create discounts and homepage banners' },
  { id: 'orders',    label: 'Orders',           icon: 'cart',      sub: 'Track and manage customer orders' },
]

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */
export default function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toasts, setToasts] = useState([])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [activeTab])

  const [medicines, setMedicines] = useState([])
  const [nonMedicines, setNonMedicines] = useState([])
  const [offers, setOffers] = useState([])
  const [homepageOffer, setHomepageOffer] = useState('')
  const [orders, setOrders] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const pushToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400)
  }, [])

  const dismissToast = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  )

  const handleNonMedicinalCreated = useCallback((newItem) => {
    if (!newItem?._id) return
    setNonMedicines((prev) => {
      if (prev.some((p) => p._id === newItem._id)) return prev
      return [newItem, ...prev]
    })
  }, [])

  const loadData = useCallback(async () => {
    setDataLoading(true)
    const results = await Promise.allSettled([
      api.get('/medicine'),
      api.get('/nonmedicinal'),
      api.get('/admin/settings'),
      api.get('/admin/offers'),
      api.get('/admin/orders'),
    ])

    if (results[0].status === 'fulfilled') {
      const d = results[0].value
      setMedicines(Array.isArray(d) ? d : d.medicines || [])
    }
    if (results[1].status === 'fulfilled') {
      const d = results[1].value
      setNonMedicines(Array.isArray(d) ? d : d.items || d.nonMedicines || [])
    }
    if (results[2].status === 'fulfilled') {
      const s = results[2].value.settings || results[2].value
      setHomepageOffer(s?.homepageOffer || '')
      if (Array.isArray(s?.offers)) setOffers(s.offers)
    }
    if (results[3].status === 'fulfilled') {
      const d = results[3].value
      const list = Array.isArray(d) ? d : d.offers || []
      if (list.length) setOffers(list)
    }
    if (results[4].status === 'fulfilled') {
      const d = results[4].value
      setOrders(Array.isArray(d) ? d : d.orders || [])
    }

    setDataLoading(false)
  }, [])

  useEffect(() => {
    const fetchAdmin = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Please login first.')
        setLoading(false)
        return
      }
      try {
        const data = await api.get('/admin/me')
        setAdmin(data.admin || data.user || { name: 'Admin' })
        await loadData()
      } catch (err) {
        setError(err.message || 'Admin access denied')
      } finally {
        setLoading(false)
      }
    }
    fetchAdmin()
  }, [loadData])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    window.location.href = '/login'
  }

  const initials = useMemo(() => {
    const name = admin?.name || 'Admin'
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  }, [admin])

  const current = NAV.find((n) => n.id === activeTab)

  if (loading) {
    return (
      <div className="center-screen">
        <div className="loader-ring" />
        <h2>Checking admin access…</h2>
        <p>Please wait a moment</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="deny-card">
          <div className="deny-icon"><Icon name="alert" size={28} /></div>
          <h2>Access denied</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={handleLogout}>Go to login</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="admin-bg" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <div className="admin-shell">
        {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}

        <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}>
          <div className="brand">
            <div className="brand-mark">M</div>
            <div className="brand-text">
              <h1>MediCare</h1>
              <p>Admin Console</p>
            </div>
            <button
              className="sidebar-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <nav className="nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={`nav-item${activeTab === item.id ? ' is-active' : ''}`}
                onClick={() => { setActiveTab(item.id); setMobileOpen(false) }}
              >
                <span className="nav-icon"><Icon name={item.icon} size={19} /></span>
                <span className="nav-label">{item.label}</span>
                <span className="nav-glow" />
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="admin-chip">
              <div className="avatar">{initials}</div>
              <div className="admin-chip-text">
                <strong>{admin?.name || 'Admin'}</strong>
                <span>{admin?.email || 'admin@medicare'}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <Icon name="logout" size={18} /> Logout
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar">
            <button
              className="menu-btn"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <Icon name="menu" size={20} />
            </button>

            <div className="topbar-brand-mobile">
              <div className="brand-mark sm">M</div>
              <span>MediCare</span>
            </div>

            <div className="topbar-title">
              <h2>{current?.label}</h2>
              <p>{current?.sub}</p>
            </div>

            <div className="topbar-right">
              <span className="date-pill">
                {new Date().toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>

              <NotificationBell />

              <div className="avatar sm">{initials}</div>
            </div>
          </header>

          <div className="admin-content" key={activeTab}>
            {activeTab === 'dashboard' && (
              <Dashboard
                medicines={medicines}
                nonMedicines={nonMedicines}
                offers={offers}
                orders={orders}
                loading={dataLoading}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'add' && (
              <AddItems pushToast={pushToast} onCreated={loadData} />
            )}

            {activeTab === 'update' && (
              <UpdateItems
                medicines={medicines}
                nonMedicines={nonMedicines}
                loading={dataLoading}
                reload={loadData}
                pushToast={pushToast}
              />
            )}

            {activeTab === 'billing' && (
              <OfflineBilling
                medicines={medicines}
                nonMedicines={nonMedicines}
                pushToast={pushToast}
                reload={loadData}
              />
            )}

            {activeTab === 'offer' && (
              <AddOffer
                offers={offers}
                homepageOffer={homepageOffer}
                nonMedicines={nonMedicines}
                onNonMedicinalCreated={handleNonMedicinalCreated}
                reload={loadData}
                pushToast={pushToast}
              />
            )}

            {activeTab === 'orders' && (
              <Orders
                orders={orders}
                loading={dataLoading}
                pushToast={pushToast}
                reload={loadData}
              />
            )}
          </div>
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}