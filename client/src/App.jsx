import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Store from './pages/Store'
import MySites from './pages/MySites'
import InstanceDetail from './pages/InstanceDetail'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import AdminLimits from './pages/AdminLimits'
import AdminOrders from './pages/AdminOrders'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <Login />
      } />

      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      <Route path="/store" element={
        <ProtectedRoute><Store /></ProtectedRoute>
      } />

      <Route path="/sites" element={
        <ProtectedRoute><MySites /></ProtectedRoute>
      } />

      <Route path="/sites/:instanceName" element={
        <ProtectedRoute><InstanceDetail /></ProtectedRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><AdminDashboard /></AdminRoute>
      } />

      <Route path="/admin/users" element={
        <AdminRoute><AdminUsers /></AdminRoute>
      } />

      <Route path="/admin/limits" element={
        <AdminRoute><AdminLimits /></AdminRoute>
      } />

      <Route path="/admin/orders" element={
        <AdminRoute><AdminOrders /></AdminRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}