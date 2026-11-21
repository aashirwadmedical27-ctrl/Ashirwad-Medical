import { useEffect, useMemo, useState } from 'react'

/* ------------------------------------------------------------------ */
/*  LOCAL HELPERS                                                      */
/* ------------------------------------------------------------------ */
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const toDateInput = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const daysUntil = (date) => {
  if (!date) return 0
  const diff = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function useCountUp(target = 0, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

/* ------------------------------------------------------------------ */
/*  THRESHOLD SETTINGS (persisted to localStorage)                     */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = 'dashboardThresholds'

const DEFAULT_SETTINGS = {
  expiryMonths: 3,   // show medicines expiring within N months
  stockMin: 0,       // stock range lower bound (inclusive)
  stockMax: 10,      // stock range upper bound (inclusive)
}

const MONTH_OPTIONS = [1, 2, 3, 6, 12]

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)

    const expiryMonths = Number(parsed.expiryMonths)
    const stockMin = Number(parsed.stockMin)
    const stockMax = Number(parsed.stockMax)

    return {
      expiryMonths:
        Number.isFinite(expiryMonths) && expiryMonths > 0
          ? expiryMonths
          : DEFAULT_SETTINGS.expiryMonths,
      stockMin:
        Number.isFinite(stockMin) && stockMin >= 0
          ? stockMin
          : DEFAULT_SETTINGS.stockMin,
      stockMax:
        Number.isFinite(stockMax) && stockMax >= 0
          ? stockMax
          : DEFAULT_SETTINGS.stockMax,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/* ------------------------------------------------------------------ */
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  plus: <><path d="M12 5v14M5 12h14" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  cart: <><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3.2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></>,
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

function StatCard({ label, value, icon, tone, delay }) {
  const animated = useCountUp(value)
  return (
    <article className={`stat-card tone-${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-top">
        <span className="stat-icon"><Icon name={icon} size={22} /></span>
        <span className="stat-spark" />
      </div>
      <h3 className="stat-value">{animated}</h3>
      <p className="stat-label">{label}</p>
      <span className="stat-shine" />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  THRESHOLD SETTINGS PANEL                                           */
/* ------------------------------------------------------------------ */
function ThresholdPanel({ settings, onChange, onReset }) {
  return (
    <div className="attention-settings">
      <div className="settings-row">
        <span className="settings-label">Expiry within</span>
        <div className="month-chips">
          {MONTH_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={`month-chip${settings.expiryMonths === m ? ' is-active' : ''}`}
              onClick={() => onChange('expiryMonths', m)}
            >
              {m} {m === 1 ? 'month' : 'months'}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Stock between</span>
        <div className="stock-range">
          <input
            type="number"
            min="0"
            value={settings.stockMin}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0)
              onChange('stockMin', v)
            }}
            className="stock-input"
            aria-label="Minimum stock"
            placeholder="0"
          />
          <span className="range-sep">to</span>
          <input
            type="number"
            min="0"
            value={settings.stockMax}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0)
              onChange('stockMax', v)
            }}
            className="stock-input"
            aria-label="Maximum stock"
            placeholder="10"
          />
        </div>
      </div>

      <button
        type="button"
        className="settings-reset"
        onClick={onReset}
      >
        Reset to defaults
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DASHBOARD                                                          */
/* ------------------------------------------------------------------ */
export default function Dashboard({
  medicines,
  nonMedicines,
  offers,
  orders,
  loading,
  onNavigate,
}) {
  const [settings, setSettings] = useState(() => loadSettings())
  const [showSettings, setShowSettings] = useState(false)

  /* Persist thresholds to localStorage whenever they change */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* ignore storage quota / privacy errors */
    }
  }, [settings])

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS })

  /* ------------- Filtering based on admin thresholds ------------- */
  const { expiringList, lowStockList } = useMemo(() => {
    const now = Date.now()
    const expiryWindow = settings.expiryMonths * 30 * 24 * 60 * 60 * 1000

    const { stockMin, stockMax } = settings
    const min = Math.min(stockMin, stockMax)
    const max = Math.max(stockMin, stockMax)

    const expiringList = medicines
      .filter((m) => {
        if (!m.expiryDate) return false
        const t = new Date(m.expiryDate).getTime()
        if (Number.isNaN(t)) return false
        const diff = t - now
        return diff > 0 && diff < expiryWindow
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))

    const lowStockList = medicines
      .filter((m) => {
        const stock = Number(m.stock)
        if (!Number.isFinite(stock)) return false
        return stock >= min && stock <= max
      })
      .sort((a, b) => Number(a.stock) - Number(b.stock))

    return { expiringList, lowStockList }
  }, [medicines, settings])

  const recent = useMemo(
    () =>
      [...medicines]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5),
    [medicines]
  )

  const stats = [
    { label: 'Medicines', value: medicines.length, icon: 'pill', tone: 'indigo' },
    { label: 'Non-Medicinal', value: nonMedicines.length, icon: 'box', tone: 'cyan' },
    {
      label: 'Active Offers',
      value: offers.filter((o) => o.isActive !== false).length,
      icon: 'tag',
      tone: 'violet',
    },
    { label: 'Orders', value: orders.length, icon: 'cart', tone: 'emerald' },
  ]

  const totalAttention = expiringList.length + lowStockList.length

  return (
    <div className="stack">
      <section className="hero-card">
        <div className="hero-text">
          <span className="pill-tag">
            <Icon name="spark" size={14} /> Live overview
          </span>
          <h2>Everything is running smoothly ✨</h2>
          <p>
            You have {medicines.length} medicines, {nonMedicines.length} general items and{' '}
            {offers.length} offers configured.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('add')}>
            <Icon name="plus" size={18} /> Add new item
          </button>
          <button className="btn btn-ghost" onClick={() => onNavigate('offer')}>
            <Icon name="tag" size={18} /> Create offer
          </button>
        </div>
        <span className="hero-orb" />
      </section>

      <section className="stat-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 80} />
        ))}
      </section>

      <section className="split">
        <div className="panel">
          <header className="panel-head">
            <h3>Recent uploads</h3>
            <button className="link-btn" onClick={() => onNavigate('update')}>
              Manage →
            </button>
          </header>

          {loading ? (
            <Skeleton rows={3} />
          ) : recent.length === 0 ? (
            <Empty icon="pill" title="No medicines yet" text="Add your first medicine to see it here." />
          ) : (
            <ul className="list">
              {recent.map((m, i) => (
                <li
                  key={m._id || i}
                  className="list-row"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="thumb">
                    {m.image ? <img src={m.image} alt="" /> : <Icon name="pill" size={18} />}
                  </span>
                  <div className="list-main">
                    <strong>{m.name}</strong>
                    <span>{m.manufacturer}</span>
                  </div>
                  <div className="list-side">
                    <b>{money(m.price)}</b>
                    <span>{m.stock} in stock</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <header className="panel-head">
            <h3>Needs attention</h3>
            <div className="attention-actions">
              <span className="count-chip">{totalAttention}</span>
              <button
                type="button"
                className={`settings-trigger${showSettings ? ' is-open' : ''}`}
                onClick={() => setShowSettings((v) => !v)}
                aria-label={showSettings ? 'Close threshold settings' : 'Open threshold settings'}
                title={showSettings ? 'Close settings' : 'Set thresholds'}
              >
                <Icon name={showSettings ? 'close' : 'settings'} size={16} />
              </button>
            </div>
          </header>

          {showSettings && (
            <ThresholdPanel
              settings={settings}
              onChange={updateSetting}
              onReset={resetSettings}
            />
          )}

          <p className="attention-hint">
            <Icon name="filter" size={12} />
            <span>
              Expiry within{' '}
              <b>
                {settings.expiryMonths}{' '}
                {settings.expiryMonths === 1 ? 'month' : 'months'}
              </b>
              <span className="hint-sep">·</span>
              Stock between <b>{settings.stockMin}–{settings.stockMax}</b>
            </span>
          </p>

          {loading ? (
            <Skeleton rows={3} />
          ) : totalAttention === 0 ? (
            <Empty
              icon="check"
              title="All good!"
              text="No items match your current thresholds."
            />
          ) : (
            <ul className="alert-list">
              {lowStockList.map((m, i) => (
                <li
                  key={`ls-${m._id || i}`}
                  className="alert-row warn"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="alert-dot" />
                  <div>
                    <strong>{m.name}</strong>
                    <span>
                      {m.stock} in stock · threshold {settings.stockMin}–{settings.stockMax}
                    </span>
                  </div>
                </li>
              ))}
              {expiringList.map((m, i) => {
                const days = daysUntil(m.expiryDate)
                return (
                  <li
                    key={`ex-${m._id || i}`}
                    className="alert-row danger"
                    style={{ animationDelay: `${(lowStockList.length + i) * 60}ms` }}
                  >
                    <span className="alert-dot" />
                    <div>
                      <strong>{m.name}</strong>
                      <span>
                        Expires in {days} {days === 1 ? 'day' : 'days'} · {toDateInput(m.expiryDate)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}