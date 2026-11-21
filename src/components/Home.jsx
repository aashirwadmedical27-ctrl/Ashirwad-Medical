import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import CustomerNavigation from '../customer/CustomerNavigation'
import './Home.css'

const api = axios.create({ baseURL: 'http://localhost:5000/api' })

const Icon = ({ name, size = 22, stroke = 'currentColor', strokeWidth = 1.8 }) => {
  const icons = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    pill: <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    receipt: <><path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3Z" /><path d="M8 8h8M8 12h8" /></>,
    close: <><path d="M18 6 6 18M6 6l12 12" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

function CatalogImage({ item, className = '' }) {
  const [failed, setFailed] = useState(false)
  const fallbackIcon = item.itemType === 'Medicine' ? 'pill' : 'box'

  return (
    <div className={`catalog-image ${className}`}>
      {item.image && !failed ? (
        <img src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="catalog-image-fallback"><Icon name={fallbackIcon} size={32} /></span>
      )}
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [medicines, setMedicines] = useState([])
  const [essentials, setEssentials] = useState([])
  const [offers, setOffers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.allSettled([
      api.get('/medicine'),
      api.get('/nonmedicinal'),
      api.get('/admin/offers'),
    ]).then(([medicineResult, essentialsResult, offersResult]) => {
      if (!active) return
      if (medicineResult.status === 'fulfilled') {
        setMedicines(medicineResult.value.data.medicines || [])
      }
      if (essentialsResult.status === 'fulfilled') {
        setEssentials(essentialsResult.value.data.items || essentialsResult.value.data.nonMedicines || [])
      }
      if (offersResult.status === 'fulfilled') {
        const list = offersResult.value.data.offers || []
        setOffers(list.filter((offer) => offer.isActive !== false))
      }
      setLoading(false)
    })

    return () => { active = false }
  }, [])

  const products = useMemo(() => [
    ...medicines.map((item) => ({
      ...item,
      itemType: 'Medicine',
      stock: Number(item.stock) || 0,
      price: Number(item.price) || 0,
      meta: item.manufacturer || 'Medicine',
    })),
    ...essentials.map((item) => ({
      ...item,
      itemType: 'NonMedicinalItem',
      stock: Number(item.stock) || 0,
      price: Number(item.price) || 0,
      meta: 'Health essential',
    })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [medicines, essentials])

  const availableProducts = products.filter((item) => item.stock > 0 && item.price > 0)
  const featuredProducts = availableProducts.slice(0, 4)
  const heroProduct = featuredProducts[0] || products[0]
  const featuredOffer = offers
    .filter((offer) => Number(offer.discountPercentage) > 0 || offer.freeItem)
    .sort((a, b) => Number(b.discountPercentage || 0) - Number(a.discountPercentage || 0))[0]

  const submitSearch = (event) => {
    event.preventDefault()
    const term = search.trim()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  return (
    <div className="home-page">
      <CustomerNavigation />

      <main className="home-main">
        <form className="home-search" onSubmit={submitSearch} role="search">
          <Icon name="search" size={19} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search medicines and essentials"
            aria-label="Search medicines and essentials"
          />
          <button type="submit" aria-label="Search"><Icon name="arrow" size={18} /></button>
        </form>

        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow"><span /> Your neighbourhood pharmacy</span>
            <h1>Everyday care,<br /><em>within reach.</em></h1>
            <p>Find medicines and health essentials from one simple catalogue.</p>
            <Link to="/shop" className="home-primary-link">Browse the catalogue <Icon name="arrow" size={17} /></Link>
            <div className="home-hero-note"><Icon name="check" size={15} /> Prescription details shown on every medicine</div>
          </div>

          <div className="home-hero-visual" aria-label={heroProduct ? `Featured product: ${heroProduct.name}` : 'Ashirvad Medical pharmacy'}>
            <div className="hero-sunwash" />
            {heroProduct ? (
              <Link to={`/product/${heroProduct.itemType === 'Medicine' ? 'medicine' : 'nonmedicinal'}/${heroProduct._id}`} className="hero-product">
                <span className="hero-product-kicker">FROM THE CATALOGUE</span>
                <CatalogImage item={heroProduct} className="hero-product-image" />
                <div className="hero-product-meta">
                  <span>{heroProduct.itemType === 'Medicine' ? 'Medicine' : 'Health essential'}</span>
                  <strong>{heroProduct.name}</strong>
                  <b>₹{heroProduct.price.toLocaleString('en-IN')}</b>
                </div>
              </Link>
            ) : (
              <div className="hero-empty-art"><span><Icon name="plus" size={38} strokeWidth={2.3} /></span><b>Care, made simple</b></div>
            )}
            <span className="hero-stamp"><Icon name="pill" size={17} /> Shop with care</span>
          </div>
        </section>

        <section className="home-categories" aria-label="Shop by category">
          <Link to="/shop?category=medicine" className="home-category home-category-medicine">
            <span className="home-category-icon"><Icon name="pill" size={23} /></span>
            <span className="home-category-copy"><strong>Medicines</strong><small>{loading ? 'Loading catalogue' : `${medicines.length} listed`}</small></span>
            <Icon name="arrow" size={17} />
          </Link>
          <Link to="/shop?category=nonmedicinal" className="home-category home-category-essential">
            <span className="home-category-icon"><Icon name="box" size={23} /></span>
            <span className="home-category-copy"><strong>Health essentials</strong><small>{loading ? 'Loading catalogue' : `${essentials.length} listed`}</small></span>
            <Icon name="arrow" size={17} />
          </Link>
        </section>

        {featuredOffer && (
          <section className="home-offer" aria-label="Current offer">
            <div className="offer-mark">% </div>
            <div className="offer-copy">
              <span>AVAILABLE OFFER</span>
              <strong>
                {Number(featuredOffer.discountPercentage) > 0
                  ? `${Number(featuredOffer.discountPercentage)}% off selected order totals`
                  : 'A free item with a qualifying order'}
              </strong>
              <small>Minimum order ₹{Number(featuredOffer.minAmount || 0).toLocaleString('en-IN')}</small>
            </div>
            <Link to="/shop" aria-label="Browse items for this offer"><Icon name="arrow" size={19} /></Link>
          </section>
        )}

        <section className="home-products-section">
          <div className="home-section-heading">
            <div><span className="home-section-kicker">AVAILABLE NOW</span><h2>Recently added</h2></div>
            <Link to="/shop" className="home-text-link">View all <Icon name="arrow" size={15} /></Link>
          </div>

          <div className="home-product-grid">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="home-product-skeleton" />)
            ) : featuredProducts.length === 0 ? (
              <div className="home-empty-state">
                <span><Icon name="box" size={22} /></span>
                <div><strong>Nothing to show just yet</strong><p>Browse the catalogue to see available products.</p></div>
                <Link to="/shop">Open catalogue <Icon name="arrow" size={15} /></Link>
              </div>
            ) : (
              featuredProducts.map((item) => (
                <Link
                  to={`/product/${item.itemType === 'Medicine' ? 'medicine' : 'nonmedicinal'}/${item._id}`}
                  key={`${item.itemType}-${item._id}`}
                  className="home-product-card"
                >
                  <CatalogImage item={item} />
                  <span className={`product-type ${item.itemType === 'Medicine' ? 'type-medicine' : 'type-essential'}`}>
                    {item.itemType === 'Medicine' ? 'Medicine' : 'Essential'}
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.meta}</p>
                  {item.prescriptionRequired && <span className="rx-label">Prescription required</span>}
                  <div className="home-product-foot"><strong>₹{item.price.toLocaleString('en-IN')}</strong><span>View <Icon name="arrow" size={14} /></span></div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="home-care-strip" aria-label="Ordering information">
          <div><span className="care-icon care-rx"><Icon name="pill" size={18} /></span><p><strong>Prescription-aware</strong><small>Requirements are marked on medicines.</small></p></div>
          <div><span className="care-icon care-orders"><Icon name="receipt" size={18} /></span><p><strong>Order updates</strong><small>Review your orders from the shop.</small></p></div>
          <div><span className="care-icon care-account"><Icon name="user" size={18} /></span><p><strong>Your account</strong><small>Save delivery addresses at checkout.</small></p></div>
        </section>

        <footer className="home-footer">
          <Link to="/" className="home-brand home-footer-brand">
            <span className="home-brand-mark"><Icon name="plus" size={17} strokeWidth={2.6} /></span>
            <span className="home-brand-name">Ashirvad<small>Medical</small></span>
          </Link>
          <p>Browse thoughtfully. Order with care.</p>
          <Link to="/shop">Open catalogue <Icon name="arrow" size={14} /></Link>
        </footer>
      </main>

    </div>
  )
}

export default Home