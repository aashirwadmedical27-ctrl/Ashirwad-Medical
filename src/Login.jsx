
import { useEffect, useState } from 'react';
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

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */

const needsProfileCompletion = (user, role) => {
  if (role === 'admin') return false;
  if (!user) return true;

  return !user.phone || !user.gender || !user.dateOfBirth;
};

/* ------------------------------------------------------------------ */
/* ICONS                                                              */
/* ------------------------------------------------------------------ */

const EyeIcon = ({ hidden = false }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {hidden ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
        <path d="M9.88 4.24A10.8 10.8 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-3.17 4.4" />
        <path d="M6.61 6.61C3.77 8.7 2 12 2 12s3 8 10 8a10.8 10.8 0 0 0 4.24-.88" />
      </>
    ) : (
      <>
        <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6-8 10-8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* COMPONENT                                                          */
/* ------------------------------------------------------------------ */

function Login() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login');

  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

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

  /* ================================================================
     RESPONSIVE GOOGLE BUTTON WIDTH

     The Google OAuth component renders its own iframe.
     Therefore, CSS max-width alone cannot reliably prevent
     the iframe from being wider than a small phone.

     We calculate the actual available viewport width and
     provide that width directly to GoogleLogin.
  ================================================================ */

  const [googleButtonWidth, setGoogleButtonWidth] = useState(280);

  useEffect(() => {
    const calculateGoogleWidth = () => {
      const viewportWidth = window.innerWidth;

      let availableWidth;

      if (viewportWidth <= 359) {
        /*
          Very small phones:

          viewport
          - page padding
          - form section padding
          = usable width
        */

        availableWidth = viewportWidth - 20 - 32;
      } else if (viewportWidth < 900) {
        /*
          Normal mobile/tablet
        */

        availableWidth = viewportWidth - 32 - 40;
      } else {
        /*
          Desktop form section has 55px padding
          on each side.
        */

        availableWidth = viewportWidth - 110;
      }

      /*
        Google recommends a reasonable button width.
        Keep it:
          minimum: 200px
          maximum: 350px
      */

      const safeWidth = Math.max(
        200,
        Math.min(350, availableWidth)
      );

      setGoogleButtonWidth(Math.floor(safeWidth));
    };

    calculateGoogleWidth();

    window.addEventListener('resize', calculateGoogleWidth);

    return () => {
      window.removeEventListener(
        'resize',
        calculateGoogleWidth
      );
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* MESSAGE HELPERS                                                   */
  /* ------------------------------------------------------------------ */

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  /* ------------------------------------------------------------------ */
  /* FORM CHANGES                                                       */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* POST AUTH ROUTING                                                  */
  /* ------------------------------------------------------------------ */

  const redirectAfterAuth = (userRole, user) => {
    if (userRole === 'admin') {
      navigate('/admin');
      return;
    }

    if (needsProfileCompletion(user, userRole)) {
      navigate('/complete-profile');
      return;
    }

    navigate('/');
  };

  /* ------------------------------------------------------------------ */
  /* NORMAL LOGIN                                                       */
  /* ------------------------------------------------------------------ */

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
        redirectAfterAuth(userRole, data.user);
      }, 500);
    } catch (err) {
      setError(
        err.message || 'Something went wrong'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* SIGN UP                                                            */
  /* ------------------------------------------------------------------ */

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
        throw new Error(
          data.message || 'Signup failed'
        );
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
        redirectAfterAuth(userRole, data.user);
      }, 500);
    } catch (err) {
      setError(
        err.message || 'Something went wrong'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* GOOGLE LOGIN                                                       */
  /* ------------------------------------------------------------------ */

  const handleGoogleSuccess = async (
    credentialResponse
  ) => {
    clearMessages();
    setGoogleLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/google`,
        {
          credential:
            credentialResponse.credential,
        }
      );

      if (!response.data?.token) {
        throw new Error(
          response.data?.message ||
            'Google login failed'
        );
      }

      const token = response.data.token;
      const user = response.data.user;

      const userRole =
        user?.role || getRoleFromToken(token);

      localStorage.setItem('token', token);
      localStorage.setItem(
        'userRole',
        userRole
      );

      if (user) {
        localStorage.setItem(
          'user',
          JSON.stringify(user)
        );
      }

      setSuccess(
        'Google login successful!'
      );

      setTimeout(() => {
        redirectAfterAuth(
          userRole,
          user
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

  /* ------------------------------------------------------------------ */
  /* FORGOT PASSWORD                                                    */
  /* ------------------------------------------------------------------ */

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    clearMessages();

    if (!forgotEmail.trim()) {
      setError(
        'Please enter your admin email address.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: forgotEmail.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to process request'
        );
      }

      setSuccess(
        'If this admin email exists, a password reset link has been sent.'
      );

      setForgotEmail('');
      setShowForgotPassword(false);
    } catch (err) {
      setError(
        err.message ||
          'Unable to process request'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* ================================================================
     FORGOT PASSWORD SCREEN
  ================================================================ */

  if (showForgotPassword) {
    return (
      <>
        <style>{`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #root {
            margin: 0;
            min-height: 100%;
          }

          button,
          input {
            font: inherit;
          }

          .auth-page {
            min-height: 100dvh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background:
              radial-gradient(
                circle at 0% 0%,
                rgba(37, 99, 235, 0.10),
                transparent 32%
              ),
              radial-gradient(
                circle at 100% 100%,
                rgba(20, 184, 166, 0.10),
                transparent 32%
              ),
              #f7faff;
            font-family:
              Inter,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .reset-card {
            width: 100%;
            max-width: 430px;
            background: #ffffff;
            border-radius: 22px;
            padding: 28px 22px;
            box-shadow:
              0 18px 50px rgba(15, 23, 42, 0.10);
          }

          .reset-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #eff6ff;
            color: #2563eb;
            margin-bottom: 18px;
          }

          .reset-head {
            margin-bottom: 24px;
          }

          .reset-head h2 {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 26px;
            line-height: 1.2;
            font-weight: 800;
            letter-spacing: -0.5px;
          }

          .reset-head p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .back-link {
            width: 100%;
            min-height: 46px;
            margin-top: 12px;
            border: none;
            background: transparent;
            color: #2563eb;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }

          @media (max-width: 359px) {
            .auth-page {
              padding: 10px;
            }

            .reset-card {
              padding: 24px 16px;
              border-radius: 18px;
            }

            .reset-head h2 {
              font-size: 24px;
            }
          }
        `}</style>

        <div className="auth-page">
          <div className="reset-card">

            <div className="reset-icon">
              <ShieldIcon />
            </div>

            <div className="reset-head">

              <h2>
                Reset password
              </h2>

              <p>
                Enter the admin email address.
                If an admin account exists, we
                will send a reset link.
              </p>

            </div>

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

            <form
              onSubmit={handleForgotPassword}
              className="auth-form"
            >

              <div className="input-group">

                <label htmlFor="forgot-admin-email">
                  Admin email
                </label>

                <input
                  id="forgot-admin-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) =>
                    setForgotEmail(
                      e.target.value
                    )
                  }
                  placeholder="admin@yourlab.com"
                  required
                  autoComplete="email"
                  inputMode="email"
                />

              </div>

              <button
                type="submit"
                className="primary-btn"
                disabled={isLoading}
              >
                {isLoading
                  ? 'Sending...'
                  : 'Send reset link'}
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
              <ArrowLeftIcon />
              Back to admin login
            </button>

          </div>
        </div>
      </>
    );
  }

  /* ================================================================
     MAIN AUTH SCREEN
  ================================================================ */

  return (
    <>
      <style>{`

        /* ============================================================
           RESET
        ============================================================ */

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
        }

        button,
        input {
          font: inherit;
        }

        /* ============================================================
           PAGE
        ============================================================ */

        .auth-page {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;

          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(37, 99, 235, 0.10),
              transparent 32%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(20, 184, 166, 0.10),
              transparent 32%
            ),
            #f7faff;

          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          color: #0f172a;

          position: relative;

          overflow-x: hidden;
        }

        /* ============================================================
           BACKGROUND
        ============================================================ */

        .background-circle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .circle-one {
          width: 240px;
          height: 240px;
          background: rgba(37, 99, 235, 0.055);
          top: -130px;
          left: -100px;
        }

        .circle-two {
          width: 210px;
          height: 210px;
          background: rgba(20, 184, 166, 0.055);
          bottom: -120px;
          right: -90px;
        }

        .circle-three {
          display: none;
        }

        /* ============================================================
           CARD
        ============================================================ */

        .auth-card {
          width: 100%;
          max-width: 1050px;

          display: flex;
          flex-direction: column;

          background: #ffffff;

          border-radius: 22px;

          overflow: hidden;

          position: relative;
          z-index: 2;

          box-shadow:
            0 20px 60px
              rgba(15, 23, 42, 0.10);
        }

        /* ============================================================
           BRAND
        ============================================================ */

        .auth-brand-section {
          width: 100%;

          padding: 27px 22px 24px;

          background:
            linear-gradient(
              145deg,
              #0f4c81 0%,
              #1677a9 58%,
              #159a82 100%
            );

          color: white;

          display: flex;
          align-items: center;
          justify-content: center;

          position: relative;

          overflow: hidden;
        }

        .brand-glow {
          position: absolute;

          width: 230px;
          height: 230px;

          border-radius: 50%;

          border:
            1px solid
            rgba(255,255,255,0.12);

          right: -130px;
          top: -110px;
        }

        .brand-glow-two {
          position: absolute;

          width: 180px;
          height: 180px;

          border-radius: 50%;

          border:
            1px solid
            rgba(255,255,255,0.10);

          left: -120px;
          bottom: -120px;
        }

        .brand-content {
          width: 100%;

          position: relative;
          z-index: 2;
        }

        .brand-top-row {
          display: flex;
          align-items: center;

          gap: 14px;
        }

        .brand-icon {
          width: 52px;
          height: 52px;

          flex: 0 0 52px;

          border-radius: 16px;

          background:
            rgba(255,255,255,0.15);

          border:
            1px solid
            rgba(255,255,255,0.23);

          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 24px;
          font-weight: 800;

          backdrop-filter: blur(8px);
        }

        .brand-copy {
          min-width: 0;
        }

        .brand-title {
          font-size: 25px;

          line-height: 1.12;

          margin: 0 0 5px;

          font-weight: 800;

          letter-spacing: -0.5px;
        }

        .brand-description {
          font-size: 13px;

          line-height: 1.45;

          color:
            rgba(255,255,255,0.88);

          margin: 0;

          max-width: 310px;
        }

        .brand-features {
          display: none;
        }

        /* ============================================================
           FORM SECTION
        ============================================================ */

        .auth-form-section {
          width: 100%;

          padding: 25px 20px 27px;

          display: flex;
          flex-direction: column;
          justify-content: center;

          background: #ffffff;

          /*
            Critical:
            Allows the Google iframe wrapper to shrink
            correctly inside the form.
          */
          min-width: 0;
        }

        .form-header {
          margin-bottom: 19px;
        }

        .form-header h2 {
          margin: 0;

          color: #0f172a;

          font-size: 25px;

          line-height: 1.2;

          font-weight: 800;

          letter-spacing: -0.5px;
        }

        .form-header p {
          margin: 7px 0 0;

          color: #64748b;

          font-size: 13.5px;

          line-height: 1.5;
        }

        /* ============================================================
           TABS
        ============================================================ */

        .tab-toggle {
          width: 100%;

          display: flex;

          background: #f1f5f9;

          border-radius: 12px;

          padding: 4px;

          margin-bottom: 18px;

          min-width: 0;
        }

        .tab-toggle button {
          flex: 1;

          min-width: 0;

          min-height: 44px;

          border: none;

          background: transparent;

          padding: 8px 10px;

          border-radius: 9px;

          color: #64748b;

          font-size: 14px;

          font-weight: 700;

          cursor: pointer;

          transition:
            background 0.2s ease,
            color 0.2s ease,
            box-shadow 0.2s ease;

          -webkit-tap-highlight-color:
            transparent;
        }

        .tab-toggle button.active {
          background: #ffffff;

          color: #1d4ed8;

          box-shadow:
            0 2px 8px
              rgba(15,23,42,0.08);
        }

        .tab-toggle button:active {
          transform: scale(0.98);
        }

        /* ============================================================
           MESSAGES
        ============================================================ */

        .message {
          width: 100%;

          padding: 11px 12px;

          border-radius: 10px;

          margin-bottom: 15px;

          font-size: 13px;

          line-height: 1.45;

          overflow-wrap: anywhere;
        }

        .message.error {
          background: #fef2f2;

          color: #b91c1c;

          border:
            1px solid #fecaca;
        }

        .message.success {
          background: #f0fdf4;

          color: #15803d;

          border:
            1px solid #bbf7d0;
        }

        /* ============================================================
           FORM
        ============================================================ */

        .auth-form {
          width: 100%;

          display: flex;
          flex-direction: column;

          gap: 15px;

          min-width: 0;
        }

        .signup-form {
          gap: 12px;
        }

        .input-group {
          width: 100%;

          display: flex;
          flex-direction: column;

          gap: 7px;

          min-width: 0;
        }

        .input-group label {
          color: #1e293b;

          font-size: 13.5px;

          font-weight: 700;
        }

        .input-wrapper {
          width: 100%;

          position: relative;

          min-width: 0;
        }

        .input-group input {
          width: 100%;

          height: 52px;

          padding:
            0 14px;

          border:
            1px solid #d1d9e6;

          border-radius: 11px;

          background: #ffffff;

          color: #111827;

          font-size: 15px;

          outline: none;

          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;

          -webkit-appearance: none;

          min-width: 0;
        }

        .input-group input::placeholder {
          color: #94a3b8;
        }

        .input-group input:focus {
          border-color: #2563eb;

          background: #ffffff;

          box-shadow:
            0 0 0 3px
              rgba(37,99,235,0.10);
        }

        /* ============================================================
           PASSWORD
        ============================================================ */

        .password-input {
          padding-right: 52px !important;
        }

        .password-toggle {
          position: absolute;

          right: 4px;
          top: 4px;

          width: 44px;
          height: 44px;

          border: none;

          background: transparent;

          color: #64748b;

          display: flex;

          align-items: center;
          justify-content: center;

          cursor: pointer;

          border-radius: 9px;

          -webkit-tap-highlight-color:
            transparent;
        }

        .password-toggle:active {
          background: #f1f5f9;
        }

        /* ============================================================
           PRIMARY BUTTON
        ============================================================ */

        .primary-btn {
          width: 100%;

          min-height: 53px;

          border: none;

          border-radius: 11px;

          margin-top: 2px;

          padding: 0 18px;

          background:
            linear-gradient(
              135deg,
              #2563eb,
              #1677a9
            );

          color: white;

          font-size: 15px;

          font-weight: 800;

          cursor: pointer;

          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            opacity 0.15s ease;

          box-shadow:
            0 7px 18px
              rgba(37,99,235,0.20);

          -webkit-tap-highlight-color:
            transparent;
        }

        .primary-btn:hover:not(:disabled) {
          box-shadow:
            0 10px 24px
              rgba(37,99,235,0.25);
        }

        .primary-btn:active:not(:disabled) {
          transform: scale(0.985);
        }

        .primary-btn:disabled {
          opacity: 0.65;

          cursor: not-allowed;
        }

        /* ============================================================
           DIVIDER
        ============================================================ */

        .divider {
          width: 100%;

          display: flex;

          align-items: center;

          gap: 11px;

          margin: 19px 0;

          color: #94a3b8;

          font-size: 11px;

          font-weight: 700;
        }

        .divider::before,
        .divider::after {
          content: '';

          height: 1px;

          background: #e2e8f0;

          flex: 1;

          min-width: 0;
        }

        /* ============================================================
           GOOGLE BUTTON
        ============================================================ */

        /*
          IMPORTANT FIX

          The GoogleLogin component creates an iframe.

          We DO NOT use overflow:hidden here anymore.

          The width is explicitly calculated in React and
          passed directly to GoogleLogin.
        */

        .google-wrapper {
          width: 100%;

          min-width: 0;

          min-height: 44px;

          display: flex;

          align-items: center;

          justify-content: center;

          overflow: visible;
        }

        .google-wrapper > div {
          /*
            Google's generated container.
          */

          width: auto !important;

          max-width: 100% !important;

          min-width: 0 !important;

          display: flex;

          align-items: center;

          justify-content: center;
        }

        .google-wrapper iframe {
          /*
            Never allow the iframe to exceed the
            available form width.
          */

          max-width: 100% !important;

          display: block;
        }

        .google-loading {
          width: 100%;

          min-height: 48px;

          display: flex;

          align-items: center;

          justify-content: center;

          border:
            1px solid #dbe2ea;

          border-radius: 10px;

          font-size: 13px;

          color: #64748b;

          text-align: center;
        }

        /* ============================================================
           FOOTER
        ============================================================ */

        .form-footer {
          margin-top: 17px;

          text-align: center;

          color: #64748b;

          font-size: 11.5px;

          line-height: 1.5;
        }

        .forgot-btn {
          min-height: 40px;

          padding: 5px 4px;

          border: none;

          background: transparent;

          color: #2563eb;

          font-size: 13px;

          font-weight: 700;

          cursor: pointer;

          -webkit-tap-highlight-color:
            transparent;
        }

        /* ============================================================
           VERY SMALL PHONES
           320px - 359px
        ============================================================ */

        @media (max-width: 359px) {

          .auth-page {
            padding: 10px;
          }

          .auth-card {
            border-radius: 18px;
          }

          .auth-brand-section {
            padding:
              22px 16px;
          }

          .brand-top-row {
            gap: 11px;
          }

          .brand-icon {
            width: 46px;
            height: 46px;

            flex-basis: 46px;

            border-radius: 14px;

            font-size: 21px;
          }

          .brand-title {
            font-size: 21px;
          }

          .brand-description {
            font-size: 11.5px;
          }

          .auth-form-section {
            padding:
              22px 16px 24px;
          }

          .form-header h2 {
            font-size: 23px;
          }

          .form-header p {
            font-size: 12.5px;
          }

          .tab-toggle button {
            font-size: 13px;
          }

          .input-group input {
            height: 49px;

            font-size: 14px;
          }

          .primary-btn {
            min-height: 50px;
          }

          .divider {
            margin:
              16px 0;
          }
        }

        /* ============================================================
           TABLET
        ============================================================ */

        @media (min-width: 600px) and (max-width: 899px) {

          .auth-page {
            padding: 30px;
          }

          .auth-card {
            max-width: 560px;

            border-radius: 24px;
          }

          .auth-brand-section {
            padding:
              34px 35px;
          }

          .brand-title {
            font-size: 31px;
          }

          .brand-description {
            font-size: 14px;
          }

          .auth-form-section {
            padding:
              34px 35px 40px;
          }

          .form-header h2 {
            font-size: 29px;
          }
        }

        /* ============================================================
           DESKTOP
        ============================================================ */

        @media (min-width: 900px) {

          .auth-page {
            padding: 30px;
          }

          .auth-card {
            min-height: 650px;

            display: grid;

            grid-template-columns:
              0.95fr 1.05fr;

            border-radius: 28px;

            box-shadow:
              0 30px 80px
                rgba(15, 23, 42, 0.14);
          }

          .auth-brand-section {
            padding:
              55px 48px;
          }

          .brand-top-row {
            display: block;
          }

          .brand-icon {
            width: 72px;
            height: 72px;

            border-radius: 22px;

            font-size: 32px;

            margin-bottom: 28px;
          }

          .brand-title {
            font-size: 42px;

            line-height: 1.12;

            margin-bottom: 18px;

            letter-spacing: -1px;
          }

          .brand-description {
            font-size: 17px;

            line-height: 1.7;

            max-width: 390px;
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

            color:
              rgba(255,255,255,0.94);
          }

          .feature-check {
            width: 25px;
            height: 25px;

            border-radius: 50%;

            background:
              rgba(255,255,255,0.18);

            display: flex;

            align-items: center;
            justify-content: center;

            font-size: 13px;

            flex-shrink: 0;
          }

          .auth-form-section {
            padding:
              48px 55px;
          }

          .form-header h2 {
            font-size: 32px;
          }

          .form-header p {
            font-size: 15px;
          }

          .input-group input {
            height: 48px;
          }

          .primary-btn {
            height: 50px;
          }
        }

        /* ============================================================
           REDUCED MOTION
        ============================================================ */

        @media (prefers-reduced-motion: reduce) {

          *,
          *::before,
          *::after {
            animation-duration:
              0.01ms !important;

            animation-iteration-count:
              1 !important;

            transition-duration:
              0.01ms !important;
          }
        }

      `}</style>

      <div className="auth-page">

        {/* Decorative background */}

        <div className="background-circle circle-one" />
        <div className="background-circle circle-two" />
        <div className="background-circle circle-three" />

        <div className="auth-card">

          {/* ========================================================
              BRAND SECTION
          ======================================================== */}

          <section className="auth-brand-section">

            <div className="brand-glow" />
            <div className="brand-glow-two" />

            <div className="brand-content">

              <div className="brand-top-row">

                <div className="brand-icon">
                  M
                </div>

                <div className="brand-copy">

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

                </div>

              </div>

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

          {/* ========================================================
              FORM SECTION
          ======================================================== */}

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

            {/* ======================================================
                TABS
            ====================================================== */}

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

            {/* ======================================================
                MESSAGES
            ====================================================== */}

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

            {/* ======================================================
                LOGIN
            ====================================================== */}

            {activeTab === 'login' ? (

              <>

                <form
                  onSubmit={handleLoginSubmit}
                  className="auth-form"
                >

                  {/* Email */}

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
                      inputMode="email"
                    />

                  </div>

                  {/* Password */}

                  <div className="input-group">

                    <label htmlFor="login-password">
                      Password
                    </label>

                    <div className="input-wrapper">

                      <input
                        id="login-password"
                        type={
                          showLoginPassword
                            ? 'text'
                            : 'password'
                        }
                        name="password"
                        value={loginForm.password}
                        onChange={handleLoginChange}
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                        className="password-input"
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showLoginPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        onClick={() =>
                          setShowLoginPassword(
                            !showLoginPassword
                          )
                        }
                      >
                        <EyeIcon
                          hidden={
                            showLoginPassword
                          }
                        />
                      </button>

                    </div>

                  </div>

                  {/* Login */}

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

                {/* ==================================================
                    GOOGLE
                ================================================== */}

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

                      /*
                        THIS IS THE IMPORTANT FIX.

                        Instead of hardcoding:

                        width="350"

                        we dynamically provide the
                        actual available width.
                      */

                      width={googleButtonWidth}
                    />

                  )}

                </div>

                {/* Forgot password */}

                <div
                  className="form-footer"
                  style={{
                    marginTop: 10,
                  }}
                >

                  <button
                    type="button"
                    className="forgot-btn"
                    onClick={() => {
                      clearMessages();
                      setShowForgotPassword(true);
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

              /* ====================================================
                 SIGN UP
              ==================================================== */

              <form
                onSubmit={handleSignupSubmit}
                className="auth-form signup-form"
              >

                {/* Name */}

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

                {/* Email */}

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
                    inputMode="email"
                  />

                </div>

                {/* Phone */}

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
                    inputMode="tel"
                  />

                </div>

                {/* Password */}

                <div className="input-group">

                  <label htmlFor="signup-password">
                    Password
                  </label>

                  <div className="input-wrapper">

                    <input
                      id="signup-password"
                      type={
                        showSignupPassword
                          ? 'text'
                          : 'password'
                      }
                      name="password"
                      value={signupForm.password}
                      onChange={handleSignupChange}
                      placeholder="Create a password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="password-input"
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={
                        showSignupPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      onClick={() =>
                        setShowSignupPassword(
                          !showSignupPassword
                        )
                      }
                    >
                      <EyeIcon
                        hidden={
                          showSignupPassword
                        }
                      />
                    </button>

                  </div>

                </div>

                {/* Create Account */}

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

