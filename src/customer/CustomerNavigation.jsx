import { NavLink } from 'react-router-dom'
import { useStore } from './StoreContext'
import './CustomerNavigation.css'

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'Shop', to: '/shop', icon: 'shop' },
  { label: 'Cart', to: '/cart', icon: 'cart' },
  { label: 'Orders', to: '/my-orders', icon: 'orders' },
  { label: 'Account', to: '/account', icon: 'account' },
]

function Icon({ name, size = 18 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    shop: <><path d="M4 7h16l-1 14H5L4 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 12v1M15 12v1" /></>,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></>,
    orders: <><path d="M5 3h14v18l-3-2-2 2-3-2-3 2-3-2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function CustomerNavigation() {
  const { cart } = useStore()
  const cartCount = cart.reduce((total, item) => total + Number(item.quantity || 0), 0)

  const linkClass = (item) => ({
    isActive,
  }) => `customer-nav-link${isActive ? ' is-active' : ''}${item.to === '/cart' ? ' customer-cart-link' : ''}`

  return (
    <>
      <header className="customer-header">
        <NavLink to="/" end className="customer-brand">
          <span className="customer-brand-mark">A</span>
          <span>Ashirvad <b>Medical</b></span>
        </NavLink>
        <nav className="customer-header-links" aria-label="Customer navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass(item)}>
              <span className="customer-nav-icon"><Icon name={item.icon} size={17} /></span>
              <span>{item.label}</span>
              {item.to === '/cart' && cartCount > 0 && <span className="customer-cart-count">{cartCount}</span>}
            </NavLink>
          ))}
        </nav>
      </header>

      <nav className="customer-mobile-nav" aria-label="Mobile customer navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass(item)}>
            <span className="customer-nav-icon"><Icon name={item.icon} size={19} /></span>
            <span>{item.label}</span>
            {item.to === '/cart' && cartCount > 0 && <span className="customer-cart-count">{cartCount}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  )
}