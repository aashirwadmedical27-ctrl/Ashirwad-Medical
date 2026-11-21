import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import CustomerNavigation from './CustomerNavigation'
import './AccountPage.css'

const api = axios.create({ baseURL: 'http://localhost:5000/api' })

function Icon({ name, size = 19 }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    map: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 2L7.7 9.8a16 16 0 0 0 6.5 6.5l1.3-1.3a2 2 0 0 1 2-.6l2.8.5a2 2 0 0 1 1.7 2Z" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function AccountPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))
  const [error, setError] = useState('')
  const token = localStorage.getItem('token')

  useEffect(() => {
    let active = true
    if (!token) {
      return () => { active = false }
    }

    api.get('/user/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (active) setUser(response.data.user) })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'We could not load your account details.')
          if (requestError.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('userRole')
          }
        }
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [token])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    navigate('/')
  }

  return (
    <div className="account-page">
      <CustomerNavigation />
      <main className="account-main">
        <div className="account-heading">
          <span>ASHIRVAD MEDICAL · ACCOUNT</span>
          <h1>Your account</h1>
          <p>Profile details and saved delivery information.</p>
        </div>

        {loading ? (
          <div className="account-skeleton"><i /><i /><i /></div>
        ) : !token ? (
          <section className="account-guest">
            <span className="account-avatar"><Icon name="user" size={27} /></span>
            <h2>Sign in to your account</h2>
            <p>Access saved addresses and keep track of your orders.</p>
            <Link to="/login" className="account-primary">Sign in <Icon name="arrow" size={16} /></Link>
          </section>
        ) : error && !user ? (
          <section className="account-guest">
            <h2>Account unavailable</h2>
            <p>{error}</p>
            <button type="button" className="account-primary" onClick={logout}>Sign in again</button>
          </section>
        ) : user && (
          <div className="account-layout">
            <section className="account-profile-panel">
              <div className="account-profile-head">
                <span className="account-avatar"><Icon name="user" size={25} /></span>
                <div><small>PERSONAL PROFILE</small><h2>{user.name || 'Customer'}</h2></div>
              </div>
              <div className="account-info-row"><span><Icon name="mail" size={17} /></span><div><small>Email address</small><strong>{user.email || 'Not provided'}</strong></div></div>
              <div className="account-info-row"><span><Icon name="phone" size={17} /></span><div><small>Phone number</small><strong>{user.phone || 'Not provided'}</strong></div></div>
              <div className="account-trust"><Icon name="shield" size={17} /><span>Your profile is linked to your Ashirvad Medical account.</span></div>
            </section>

            <section className="account-address-panel">
              <header><div><small>DELIVERY</small><h2>Saved addresses</h2></div><span>{user.addresses?.length || 0}</span></header>
              {user.addresses?.length ? (
                <div className="account-address-list">
                  {user.addresses.map((address) => (
                    <article key={address._id} className="account-address-card">
                      <span className="account-address-icon"><Icon name="map" size={18} /></span>
                      <div><strong>{address.label || 'Address'}</strong><p>{address.line1 || address.home}{address.line2 || address.landmark ? `, ${address.line2 || address.landmark}` : ''}</p><small>{address.city}{address.state ? `, ${address.state}` : ''} {address.pincode || address.pinCode} · {address.phone}</small></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="account-no-address"><p>No saved delivery addresses yet.</p><Link to="/cart">Add an address at checkout <Icon name="arrow" size={14} /></Link></div>
              )}
            </section>

            <section className="account-actions-panel">
              <Link to="/my-orders"><span>View your orders</span><Icon name="arrow" size={17} /></Link>
              <Link to="/shop"><span>Continue shopping</span><Icon name="arrow" size={17} /></Link>
              <button type="button" onClick={logout}><span>Sign out</span><Icon name="arrow" size={17} /></button>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}