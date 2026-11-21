import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CompleteProfile.css'

const API_URL = 'http://localhost:5000/api'

const GENDERS = ['Male', 'Female', 'Other']

function CompleteProfile() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
  })

  /* ------------------------------------------------------------------ */
  /*  Load current user from storage — redirect if not logged in         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('userRole')

    if (!token) {
      navigate('/login')
      return
    }

    // Admins skip this flow entirely
    if (role === 'admin') {
      navigate('/admin')
      return
    }

    let parsed = null
    try {
      parsed = JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      parsed = null
    }

    // Already complete → just send them home
    if (
      parsed &&
      parsed.phone &&
      parsed.gender &&
      parsed.dateOfBirth
    ) {
      navigate('/')
      return
    }

    setUser(parsed)

    setForm({
      name: parsed?.name || '',
      phone: parsed?.phone || '',
      gender: parsed?.gender || '',
      dateOfBirth: parsed?.dateOfBirth
        ? new Date(parsed.dateOfBirth).toISOString().slice(0, 10)
        : '',
    })
  }, [navigate])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  /* ------------------------------------------------------------------ */
  /*  Submit                                                             */
  /* ------------------------------------------------------------------ */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Client-side validation
    if (!form.name.trim()) {
      setError('Please enter your full name.')
      return
    }

    const phone = form.phone.trim()
    if (!phone) {
      setError('Please enter your phone number.')
      return
    }
    if (!/^[0-9+\-\s]{7,15}$/.test(phone)) {
      setError('Please enter a valid phone number (7–15 digits).')
      return
    }

    if (!form.gender) {
      setError('Please select your gender.')
      return
    }

    if (!form.dateOfBirth) {
      setError('Please enter your date of birth.')
      return
    }

    const dob = new Date(form.dateOfBirth)
    if (Number.isNaN(dob.getTime())) {
      setError('Please enter a valid date of birth.')
      return
    }
    if (dob.getTime() > Date.now()) {
      setError('Date of birth cannot be in the future.')
      return
    }

    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_URL}/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save profile')
      }

      // Keep localStorage user in sync so future checks pass
      const updatedUser = data.user || data
      localStorage.setItem('user', JSON.stringify(updatedUser))

      setSuccess('Profile saved! Redirecting…')

      const role = updatedUser.role || localStorage.getItem('userRole') || 'user'

      setTimeout(() => {
        navigate(role === 'admin' ? '/admin' : '/')
      }, 700)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-shape shape-one" />
      <div className="profile-shape shape-two" />
      <div className="profile-shape shape-three" />

      <div className="profile-card">
        <header className="profile-head">
          <div className="profile-badge">✓</div>
          <h1>Complete your profile</h1>
          <p>
            Hi{user?.name ? ` ${user.name.split(' ')[0]}` : ''}! We just
            need a few more details before you can start using your account.
          </p>
        </header>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <form className="profile-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="input-group">
            <label htmlFor="cp-name">Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                id="cp-name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div className="input-group">
            <label htmlFor="cp-phone">Phone Number</label>
            <div className="input-wrapper">
              <span className="input-icon">📱</span>
              <input
                id="cp-phone"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                autoComplete="tel"
                required
              />
            </div>
          </div>

          {/* Gender */}
          <div className="input-group">
            <label htmlFor="cp-gender">Gender</label>
            <div className="input-wrapper">
              <span className="input-icon">⚧</span>
              <select
                id="cp-gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="profile-select"
                required
              >
                <option value="">Select gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date of birth */}
          <div className="input-group">
            <label htmlFor="cp-dob">Date of Birth</label>
            <div className="input-wrapper">
              <span className="input-icon">🎂</span>
              <input
                id="cp-dob"
                type="date"
                name="dateOfBirth"
                value={form.dateOfBirth}
                onChange={handleChange}
                max={new Date().toISOString().slice(0, 10)}
                autoComplete="bday"
                required
              />
            </div>
          </div>

          <button
            className="primary-btn"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving…' : 'Save & Continue'}
          </button>
        </form>

        <p className="profile-note">
          Your delivery address will be asked when you place your first order.
        </p>
      </div>
    </div>
  )
}

export default CompleteProfile