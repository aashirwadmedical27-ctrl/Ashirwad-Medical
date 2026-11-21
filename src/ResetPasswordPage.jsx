import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams();

  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Reset link is invalid or missing a token.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to reset password');
      }

      setSuccess('Password reset successfully. Redirecting to login...');
      setForm({ password: '', confirmPassword: '' });

      setTimeout(() => {
        navigate('/admin-login');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .reset-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
          font-family: Inter, sans-serif;
        }
        .reset-card {
          width: min(100%, 440px);
          background: #ffffff;
          border-radius: 24px;
          padding: 32px 28px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
        }
        .reset-header {
          margin-bottom: 20px;
        }
        .reset-header h1 {
          margin: 0 0 8px;
          font-size: 30px;
          color: #0f172a;
        }
        .reset-header p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }
        .message {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        }
        .message.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        .message.success {
          background: #ecfdf5;
          color: #166534;
          border: 1px solid #a7f3d0;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-group label {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }
        .input-group input {
          width: 100%;
          border: 1px solid #dbe3ef;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
          transition: border 0.2s ease, box-shadow 0.2s ease;
        }
        .input-group input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }
        .primary-btn {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 13px 16px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .primary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .back-link {
          margin-top: 18px;
          width: 100%;
          border: none;
          background: transparent;
          color: #2563eb;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>

      <div className="reset-page">
        <div className="reset-card">
          <div className="reset-header">
            <h1>Set new password</h1>
            <p>Create a new password for your account.</p>
          </div>

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter new password"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                required
              />
            </div>

            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update password'}
            </button>
          </form>

          <button
            type="button"
            className="back-link"
            onClick={() => navigate('/admin-login')}
          >
            ← Back to login
          </button>
        </div>
      </div>
    </>
  );
}

export default ResetPasswordPage;
