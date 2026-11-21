import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './components/Home'  
import AdminPage from './admin/AdminPage'
import AdminLogin from './admin/AdminLogin'
import Login from './Login'
import ResetPasswordPage from './ResetPasswordPage'
import CompleteProfile from './components/CompleteProfile.jsx'
import OrderPage from './customer/OrderPage.jsx'
import ProductDetailPage from './customer/ProductDetailPage.jsx'
import AccountPage from './customer/AccountPage.jsx'

function ProtectedAdminRoute() {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('userRole')

  if (!token) {
    return <Navigate to="/admin-login" replace />
  }

  if (userRole !== 'admin') {
    return <Navigate to="/admin-login" replace />
  }

  return <AdminPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/admin" element={<ProtectedAdminRoute />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/shop" element={<OrderPage />} />
      <Route path="/cart" element={<OrderPage cartOnly />} />
      <Route path="/my-orders" element={<OrderPage initialView="orders" />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/product/:type/:id" element={<ProductDetailPage />} />
    </Routes>
  )
}

export default AppRoutes
