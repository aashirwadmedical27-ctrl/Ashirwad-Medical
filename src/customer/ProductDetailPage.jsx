import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { useStore } from './StoreContext'
import CustomerNavigation from './CustomerNavigation'
import './ProductDetailPage.css'

const api = axios.create({ baseURL: 'http://localhost:5000/api' })

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    back: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="M18 6 6 18M6 6l12 12" /></>,
    minus: <path d="M5 12h14" />,
    pill: <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function ProductDetailPage() {
  const { type, id } = useParams()
  return <ProductDetailView key={`${type}:${id}`} type={type} id={id} />
}

function ProductDetailView({ type, id }) {
  const navigate = useNavigate()
  const { cart, setCart } = useStore()
  const [resource, setResource] = useState(null)
  const [quantityDraft, setQuantityDraft] = useState('1')
  const [imageFailed, setImageFailed] = useState(false)
  const [message, setMessage] = useState('')
  const validType = type === 'medicine' || type === 'nonmedicinal'
  const productKey = `${type}:${id}`
  const loading = validType && resource?.key !== productKey
  const item = resource?.key === productKey ? resource.item : null

  useEffect(() => {
    let active = true
    if (!validType) return () => { active = false }

    const endpoint = type === 'medicine' ? 'medicine' : 'nonmedicinal'
    api.get(`/${endpoint}/${id}`)
      .then(({ data }) => {
        if (!active) return
        const source = type === 'medicine' ? data.medicine : data.item
        if (!source) throw new Error('This item could not be found.')
        const tabletsPerStrip = Number(source.tabletsPerStrip) || 1
        const stripStock = Number(source.stock) || 0
        const storedTabletUnits = Number(source.totalMedicineQuantity) || 0
        const tabletStock = storedTabletUnits > 0 || stripStock === 0
          ? storedTabletUnits
          : stripStock * tabletsPerStrip
        setResource({
          key: productKey,
          item: {
            itemType: type === 'medicine' ? 'Medicine' : 'NonMedicinalItem',
            itemId: source._id,
            name: source.name,
            meta: type === 'medicine' ? source.manufacturer || 'Medicine' : 'Health essential',
            manufacturer: source.manufacturer || '',
            description: source.description || '',
            image: source.image || '',
            price: type === 'medicine'
              ? (Number(source.price) || 0) / tabletsPerStrip
              : Number(source.price) || 0,
            stripPrice: Number(source.price) || 0,
            stock: type === 'medicine' ? tabletStock : stripStock,
            tabletsPerStrip,
            prescriptionRequired: Boolean(source.prescriptionRequired),
            expiryDate: source.expiryDate || '',
          },
          message: '',
        })
      })
      .catch((error) => {
        if (active) {
          setResource({
            key: productKey,
            item: null,
            message: error.response?.data?.message || error.message || 'Unable to load this product.',
          })
        }
      })

    return () => { active = false }
  }, [id, productKey, type, validType])

  const updateQuantityDraft = (value) => {
    if (/^\d*$/.test(value)) setQuantityDraft(value)
  }

  const commitQuantityDraft = () => {
    if (!item) return
    const parsed = Number(quantityDraft)
    const next = Math.min(Math.max(1, Number.isInteger(parsed) ? parsed : 1), item.stock)
    setQuantityDraft(String(next))
  }

  const addToCart = () => {
    const quantity = Number(quantityDraft)
    if (!item || item.stock < 1 || item.price <= 0) return
    if (!Number.isInteger(quantity) || quantity < 1) {
      setMessage('Enter a positive whole-number quantity.')
      return
    }
    const existing = cart.find((entry) => entry.itemType === item.itemType && entry.itemId === item.itemId)
    const nextQuantity = (existing?.quantity || 0) + quantity
    if (nextQuantity > item.stock) {
      setMessage(`Only ${item.stock} ${item.itemType === 'Medicine' ? 'tablets' : 'units'} are available.`)
      return
    }

    setCart((previous) => {
      const currentItem = previous.find((entry) => entry.itemType === item.itemType && entry.itemId === item.itemId)
      return currentItem
        ? previous.map((entry) => entry.itemType === item.itemType && entry.itemId === item.itemId
          ? { ...entry, quantity: entry.quantity + quantity }
          : entry)
        : [{ ...item, quantity }, ...previous]
    })
  }

  const expiryLabel = item?.expiryDate
    ? new Date(item.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not specified'

  return (
    <div className="product-detail-page">
      <CustomerNavigation />

      <main className="pd-main">
        <div className="pd-breadcrumbs">
          <Link to="/">Home</Link><span>/</span><Link to="/shop">Shop</Link><span>/</span><span>{item?.name || 'Product details'}</span>
        </div>

        {loading ? (
          <div className="pd-loading"><span /><span /><span /></div>
        ) : !item ? (
          <section className="pd-not-found">
            <span className="pd-not-found-icon"><Icon name="box" size={30} /></span>
            <h1>Product unavailable</h1>
            <p>{message || 'This item may have been removed from the catalogue.'}</p>
            <Link to="/shop" className="pd-primary-link">Back to catalogue</Link>
          </section>
        ) : (
          <>
            <section className="pd-product-layout">
              <div className="pd-gallery">
                <span className="pd-type-label">{item.itemType === 'Medicine' ? 'MEDICINE' : 'HEALTH ESSENTIAL'}</span>
                <div className="pd-image-stage">
                  {item.image && !imageFailed ? (
                    <img src={item.image} alt={item.name} onError={() => setImageFailed(true)} />
                  ) : (
                    <span className="pd-image-fallback"><Icon name={item.itemType === 'Medicine' ? 'pill' : 'box'} size={58} /></span>
                  )}
                </div>
                {item.prescriptionRequired && <span className="pd-prescription"><Icon name="shield" size={15} /> Prescription required</span>}
              </div>

              <section className="pd-info">
                <div className="pd-eyebrow"><span /> Catalogue item</div>
                <h1>{item.name}</h1>
                <p className="pd-manufacturer">{item.manufacturer || item.meta}</p>
                  <div className="pd-price-line">
                    <strong>{money(item.price)}</strong>
                    {item.itemType === 'Medicine' && <span>per tablet · strip MRP {money(item.stripPrice)}</span>}
                </div>
                <div className={`pd-stock ${item.stock > 0 ? 'is-available' : 'is-out'}`}>
                    <span />{item.stock > 0 ? `${item.stock} ${item.itemType === 'Medicine' ? 'tablets' : 'units'} available` : 'Currently out of stock'}
                </div>

                <p className="pd-description">{item.description || 'No additional description has been provided for this item.'}</p>

                {item.stock > 0 && item.price > 0 && (
                  <div className="pd-purchase-row">
                    <div className="pd-quantity" aria-label="Choose quantity">
                      <button type="button" onClick={() => setQuantityDraft(String(Math.max(1, (Number(quantityDraft) || 1) - 1)))} disabled={Number(quantityDraft) <= 1} aria-label="Decrease quantity"><Icon name="minus" size={15} /></button>
                      <input type="text" inputMode="numeric" value={quantityDraft} onChange={(event) => updateQuantityDraft(event.target.value)} onBlur={commitQuantityDraft} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} aria-label={item.itemType === 'Medicine' ? 'Number of tablets' : 'Quantity'} />
                      <button type="button" onClick={() => setQuantityDraft(String(Math.min(item.stock, (Number(quantityDraft) || 0) + 1)))} disabled={Number(quantityDraft) >= item.stock} aria-label="Increase quantity"><Icon name="plus" size={15} /></button>
                    </div>
                    <button type="button" className="pd-add-button" onClick={addToCart} disabled={!Number.isInteger(Number(quantityDraft)) || Number(quantityDraft) < 1 || Number(quantityDraft) > item.stock}>
                      Add to cart <Icon name="arrow" size={17} />
                    </button>
                  </div>
                )}
                {message && <p className="pd-inline-message" role="status">{message}</p>}

                <dl className="pd-facts">
                  <div><dt>Item type</dt><dd>{item.itemType === 'Medicine' ? 'Medicine' : 'Health essential'}</dd></div>
                  {item.manufacturer && <div><dt>Manufacturer</dt><dd>{item.manufacturer}</dd></div>}
                  {item.itemType === 'Medicine' && <div><dt>Pack size</dt><dd>{item.tabletsPerStrip} tablets per strip · {money(item.stripPrice)} per strip</dd></div>}
                  <div><dt>Expiry date</dt><dd>{expiryLabel}</dd></div>
                  <div><dt>Prescription</dt><dd>{item.prescriptionRequired ? 'Required before checkout' : 'Not required'}</dd></div>
                </dl>
              </section>
            </section>

            <section className="pd-details-note">
              <span><Icon name="check" size={16} /></span>
              <p><strong>Need more information?</strong><small>Product and stock details are supplied by the Ashirvad Medical catalogue.</small></p>
              <Link to="/shop">Continue browsing <Icon name="arrow" size={15} /></Link>
            </section>
          </>
        )}
      </main>
    </div>
  )
}