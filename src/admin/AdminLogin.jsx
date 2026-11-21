import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const getRoleFromToken = (token) => {
  if (!token) return 'user';

  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));

    return payload.role || 'user';
  } catch (error) {
    return 'user';
  }
};

function Login() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLoginChange = (e) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignupChange = (e) => {
    setSignupForm({
      ...signupForm,
      [e.target.name]: e.target.value,
    });
  };

  // ---------------------------------------
  // NORMAL LOGIN
  // ---------------------------------------

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    clearMessages();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const userRole =
        data.user?.role || getRoleFromToken(data.token);

      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', userRole);

      if (data.user) {
        localStorage.setItem(
          'user',
          JSON.stringify(data.user)
        );
      }

      setSuccess('Login successful!');

      setLoginForm({
        email: '',
        password: '',
      });

      setTimeout(() => {
        navigate(userRole === 'admin' ? '/admin' : '/');
      }, 500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------
  // SIGN UP
  // ---------------------------------------

  const handleSignupSubmit = async (e) => {
    e.preventDefault();

    clearMessages();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      const userRole =
        data.user?.role || getRoleFromToken(data.token);

      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', userRole);

      if (data.user) {
        localStorage.setItem(
          'user',
          JSON.stringify(data.user)
        );
      }

      setSuccess('Account created successfully!');

      setSignupForm({
        name: '',
        email: '',
        phone: '',
        password: '',
      });

      setTimeout(() => {
        navigate(userRole === 'admin' ? '/admin' : '/');
      }, 500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------
  // GOOGLE LOGIN
  // ---------------------------------------

  const handleGoogleSuccess = async (credentialResponse) => {
    clearMessages();
    setGoogleLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/google`,
        {
          credential: credentialResponse.credential,
        }
      );

      if (!response.data?.token) {
        throw new Error(
          response.data?.message || 'Google login failed'
        );
      }

      const token = response.data.token;
      const user = response.data.user;

      const userRole =
        user?.role || getRoleFromToken(token);

      // Store application JWT
      localStorage.setItem('token', token);

      // Store role
      localStorage.setItem('userRole', userRole);

      // Store user information
      if (user) {
        localStorage.setItem(
          'user',
          JSON.stringify(user)
        );
      }

      setSuccess('Google login successful!');

      setTimeout(() => {
        navigate(
          userRole === 'admin'
            ? '/admin'
            : '/'
        );
      }, 500);
    } catch (error) {
      console.error(
        'Google login failed:',
        error
      );

      setError(
        error.response?.data?.message ||
          error.message ||
          'Google login failed'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleLoading(false);
    setError(
      'Google sign-in was unsuccessful. Please try again.'
    );
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!forgotEmail.trim()) {
      setError('Please enter your admin email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to process request');
      }

      setSuccess(
        'If this admin email exists, a password reset link has been sent.'
      );
      setForgotEmail('');
      setShowForgotPassword(false);
    } catch (err) {
      setError(err.message || 'Unable to process request');
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <>
        <style>{`
          .reset-card {
            width: min(100%, 460px);
            background: #ffffff;
            border-radius: 26px;
            padding: 38px 30px;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
          }

          .reset-head {
            margin-bottom: 22px;
          }

          .reset-head h2 {
            margin: 0 0 8px;
            color: #111827;
            font-size: 30px;
            font-weight: 800;
          }

          .reset-head p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .back-link {
            margin-top: 18px;
            width: 100%;
            border: none;
            background: transparent;
            color: #2563eb;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
          }
        `}</style>

        <div className="auth-page">
          <div className="reset-card">
            <div className="reset-head">
              <h2>Reset password</h2>
              <p>
                Enter the admin email address. If an admin account exists,
                we will send a reset link.
              </p>
            </div>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="input-group">
                <label htmlFor="forgot-admin-email">Admin email</label>
                <input
                  id="forgot-admin-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@yourlab.com"
                  required
                />
              </div>

              <button type="submit" className="primary-btn" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <button
              type="button"
              className="back-link"
              onClick={() => {
                clearMessages();
                setShowForgotPassword(false);
                setForgotEmail('');
              }}
            >
              ← Back to admin login
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .auth-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          background:
            radial-gradient(
              circle at 15% 20%,
              rgba(59, 130, 246, 0.16),
              transparent 30%
            ),
            radial-gradient(
              circle at 85% 80%,
              rgba(16, 185, 129, 0.14),
              transparent 30%
            ),
            #f5f8fc;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* Background floating circles */

        .background-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          animation: float 8s ease-in-out infinite;
        }

        .circle-one {
          width: 280px;
          height: 280px;
          background: rgba(37, 99, 235, 0.08);
          top: -100px;
          left: -80px;
        }

        .circle-two {
          width: 220px;
          height: 220px;
          background: rgba(16, 185, 129, 0.08);
          bottom: -70px;
          right: -50px;
          animation-delay: 2s;
        }

        .circle-three {
          width: 100px;
          height: 100px;
          background: rgba(59, 130, 246, 0.07);
          top: 25%;
          right: 12%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-20px);
          }
        }

        /* Main card */

        .auth-card {
          width: 100%;
          max-width: 1050px;
          min-height: 650px;
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          background: #ffffff;
          border-radius: 28px;
          overflow: hidden;
          position: relative;
          z-index: 2;
          box-shadow:
            0 30px 80px rgba(15, 23, 42, 0.14);
          animation: cardAppear 0.7s ease;
        }

        @keyframes cardAppear {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Left section */

        .auth-brand-section {
          padding: 55px 48px;
          background:
            linear-gradient(
              145deg,
              #0f4c81,
              #1677a9 55%,
              #159a82
            );
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .brand-glow {
          position: absolute;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          right: -180px;
          top: -120px;
        }

        .brand-glow-two {
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          left: -150px;
          bottom: -100px;
        }

        .brand-content {
          position: relative;
          z-index: 2;
        }

        .brand-icon {
          width: 72px;
          height: 72px;
          border-radius: 22px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 28px;
          backdrop-filter: blur(8px);
          animation: iconPulse 3s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-7px);
          }
        }

        .brand-title {
          font-size: 42px;
          line-height: 1.12;
          margin: 0 0 18px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .brand-description {
          font-size: 17px;
          line-height: 1.7;
          color: rgba(255,255,255,0.9);
          max-width: 390px;
          margin: 0;
        }

        .brand-features {
          margin-top: 38px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .brand-feature {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          color: rgba(255,255,255,0.94);
        }

        .feature-check {
          width: 25px;
          height: 25px;
          border-radius: 50%;
          background: rgba(255,255,255,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }

        /* Right section */

        .auth-form-section {
          padding: 48px 55px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #ffffff;
        }

        .form-header {
          margin-bottom: 25px;
        }

        .form-header h2 {
          margin: 0;
          color: #111827;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.6px;
        }

        .form-header p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.5;
        }

        /* Tabs */

        .tab-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 22px;
        }

        .tab-toggle button {
          flex: 1;
          border: none;
          background: transparent;
          padding: 11px 15px;
          border-radius: 9px;
          color: #64748b;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .tab-toggle button:hover {
          color: #1e40af;
        }

        .tab-toggle button.active {
          background: white;
          color: #1d4ed8;
          box-shadow: 0 2px 8px rgba(15,23,42,0.08);
        }

        /* Messages */

        .message {
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
          line-height: 1.4;
          animation: messageAppear 0.3s ease;
        }

        .message.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .message.success {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Form */

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
          animation: formFade 0.35s ease;
        }

        @keyframes formFade {
          from {
            opacity: 0;
            transform: translateX(8px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .input-group label {
          color: #1e293b;
          font-size: 14px;
          font-weight: 700;
        }

        .input-group input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #111827;
          font-size: 15px;
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .input-group input::placeholder {
          color: #94a3b8;
        }

        .input-group input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.1);
          transform: translateY(-1px);
        }

        /* Primary button */

        .primary-btn {
          width: 100%;
          height: 50px;
          border: none;
          border-radius: 11px;
          margin-top: 3px;
          background: linear-gradient(
            135deg,
            #2563eb,
            #1677a9
          );
          color: white;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
          box-shadow:
            0 8px 20px rgba(37,99,235,0.22);
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 12px 25px rgba(37,99,235,0.28);
        }

        .primary-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .primary-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Divider */

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
        }

        .divider::before,
        .divider::after {
          content: '';
          height: 1px;
          background: #e2e8f0;
          flex: 1;
        }

        /* Google button wrapper */

        .google-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          min-height: 44px;
        }

        .google-wrapper > div {
          width: 100% !important;
          display: flex;
          justify-content: center;
        }

        .google-wrapper iframe {
          max-width: 100%;
        }

        .google-loading {
          text-align: center;
          font-size: 13px;
          color: #64748b;
          margin-top: 8px;
        }

        .form-footer {
          margin-top: 22px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .form-footer strong {
          color: #2563eb;
        }

        /* Mobile */

        @media (max-width: 850px) {
          .auth-card {
            max-width: 540px;
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .auth-brand-section {
            padding: 38px 35px;
          }

          .brand-title {
            font-size: 34px;
          }

          .brand-features {
            display: none;
          }

          .auth-form-section {
            padding: 38px 35px 45px;
          }
        }

        @media (max-width: 480px) {
          .auth-page {
            padding: 15px;
            align-items: flex-start;
            padding-top: 25px;
            overflow-y: auto;
          }

          .auth-card {
            border-radius: 20px;
          }

          .auth-brand-section {
            padding: 30px 25px;
          }

          .brand-icon {
            width: 58px;
            height: 58px;
            font-size: 25px;
            border-radius: 17px;
            margin-bottom: 20px;
          }

          .brand-title {
            font-size: 29px;
          }

          .brand-description {
            font-size: 15px;
          }

          .auth-form-section {
            padding: 30px 25px 35px;
          }

          .form-header h2 {
            font-size: 27px;
          }

          .input-group input {
            height: 47px;
          }
        }
      `}</style>

      <div className="auth-page">

        {/* Decorative background */}

        <div className="background-circle circle-one" />
        <div className="background-circle circle-two" />
        <div className="background-circle circle-three" />

        <div className="auth-card">

          {/* -------------------------------- */}
          {/* LEFT BRAND PANEL */}
          {/* -------------------------------- */}

          <section className="auth-brand-section">

            <div className="brand-glow" />
            <div className="brand-glow-two" />

            <div className="brand-content">

              <div className="brand-icon">
                M
              </div>

              <h1 className="brand-title">
                Your Health,
                <br />
                Our Priority.
              </h1>

              <p className="brand-description">
                Get your medicines and healthcare
                essentials delivered conveniently
                to your doorstep.
              </p>

              <div className="brand-features">

                <div className="brand-feature">
                  <span className="feature-check">
                    ✓
                  </span>

                  <span>
                    Easy and secure access
                  </span>
                </div>

                <div className="brand-feature">
                  <span className="feature-check">
                    ✓
                  </span>

                  <span>
                    Medicines at your convenience
                  </span>
                </div>

                <div className="brand-feature">
                  <span className="feature-check">
                    ✓
                  </span>

                  <span>
                    Fast doorstep delivery
                  </span>
                </div>

              </div>

            </div>
          </section>

          {/* -------------------------------- */}
          {/* RIGHT LOGIN/SIGNUP PANEL */}
          {/* -------------------------------- */}

          <section className="auth-form-section">

            <div className="form-header">

              <h2>
                {activeTab === 'login'
                  ? 'Welcome back'
                  : 'Create your account'}
              </h2>

              <p>
                {activeTab === 'login'
                  ? 'Sign in to continue to your account.'
                  : 'Create an account to start shopping for healthcare essentials.'}
              </p>

            </div>

            {/* Tabs */}

            <div className="tab-toggle">

              <button
                type="button"
                className={
                  activeTab === 'login'
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  clearMessages();
                  setActiveTab('login');
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={
                  activeTab === 'signup'
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  clearMessages();
                  setActiveTab('signup');
                }}
              >
                Sign Up
              </button>

            </div>

            {/* Messages */}

            {error && (
              <div className="message error">
                {error}
              </div>
            )}

            {success && (
              <div className="message success">
                {success}
              </div>
            )}

            {/* -------------------------------- */}
            {/* LOGIN */}
            {/* -------------------------------- */}

            {activeTab === 'login' ? (

              <>

                <form
                  onSubmit={handleLoginSubmit}
                  className="auth-form"
                >

                  <div className="input-group">

                    <label htmlFor="login-email">
                      Email Address
                    </label>

                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      value={loginForm.email}
                      onChange={handleLoginChange}
                      placeholder="Enter your email"
                      required
                      autoComplete="email"
                    />

                  </div>

                  <div className="input-group">

                    <label htmlFor="login-password">
                      Password
                    </label>

                    <input
                      id="login-password"
                      type="password"
                      name="password"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />

                  </div>

                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? 'Signing in...'
                      : 'Login'}
                  </button>

                </form>

                {/* Google Login */}

                <div className="divider">
                  <span>OR</span>
                </div>

                <div className="google-wrapper">

                  {googleLoading ? (
                    <div className="google-loading">
                      Signing in with Google...
                    </div>
                  ) : (
                    <GoogleLogin
                      onSuccess={
                        handleGoogleSuccess
                      }
                      onError={
                        handleGoogleError
                      }
                      theme="outline"
                      size="large"
                      text="signin_with"
                      shape="rectangular"
                      width="350"
                    />
                  )}

                </div>

                <div className="form-footer" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setShowForgotPassword(true);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#2563eb',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="form-footer">
                  By continuing, you agree to use
                  our service responsibly and securely.
                </div>

              </>

            ) : (

              /* -------------------------------- */
              /* SIGNUP */
              /* -------------------------------- */

              <form
                onSubmit={handleSignupSubmit}
                className="auth-form"
              >

                <div className="input-group">

                  <label htmlFor="signup-name">
                    Full Name
                  </label>

                  <input
                    id="signup-name"
                    type="text"
                    name="name"
                    value={signupForm.name}
                    onChange={handleSignupChange}
                    placeholder="Enter your full name"
                    required
                    autoComplete="name"
                  />

                </div>

                <div className="input-group">

                  <label htmlFor="signup-email">
                    Email Address
                  </label>

                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                  />

                </div>

                <div className="input-group">

                  <label htmlFor="signup-phone">
                    Phone Number
                  </label>

                  <input
                    id="signup-phone"
                    type="tel"
                    name="phone"
                    value={signupForm.phone}
                    onChange={handleSignupChange}
                    placeholder="Enter your phone number"
                    required
                    autoComplete="tel"
                  />

                </div>

                <div className="input-group">

                  <label htmlFor="signup-password">
                    Password
                  </label>

                  <input
                    id="signup-password"
                    type="password"
                    name="password"
                    value={signupForm.password}
                    onChange={handleSignupChange}
                    placeholder="Create a password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                </div>

                <button
                  className="primary-btn"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Creating account...'
                    : 'Create Account'}
                </button>

              </form>

            )}

          </section>

        </div>

      </div>
    </>
  );
}

export default Login;