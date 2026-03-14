'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Calendar,
  User,
  MapPin,
  ChevronDown,
  CreditCard,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  Store,
  X,
  Settings,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import Swal from 'sweetalert2'

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800', icon: Clock },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  { value: 'processing', label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: Package },
  { value: 'shipped', label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
]

const ITEMS_PER_PAGE = 15

// Debounce hook for search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  return debouncedValue
}

export default function AdminManageOrdersPage() {
  const [orders, setOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [copiedOrderId, setCopiedOrderId] = useState(null)

  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const [filters, setFilters] = useState({
    status: '',
    branch: '',
    search: '',
    customerEmail: '',
  })

  const debouncedSearch = useDebounce(filters.search, 500)
  const debouncedEmail = useDebounce(filters.customerEmail, 500)

  // Auth helpers
  const getAuthHeaders = (bustCache = false) => {
    const token = localStorage.getItem('auth-token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    if (bustCache) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      headers['Pragma'] = 'no-cache'
      headers['Expires'] = '0'
    }

    return headers
  }

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)

      // Load branches
      try {
        const headers = getAuthHeaders()
        const branchesRes = await fetch('/api/branches', { headers })

        if (branchesRes.ok) {
          const branchesData = await branchesRes.json()
          setBranches(branchesData.branches || ['mirpur', 'bashundhara'])
        } else {
          setBranches(['mirpur', 'bashundhara'])
        }
      } catch (error) {
        setBranches(['mirpur', 'bashundhara'])
      }

      // Load orders
      await fetchOrders()
    } catch (error) {
      console.error('Error loading initial data:', error)
      setError('Failed to load initial data. Please refresh the page.')
      setLoading(false)
    }
  }

  // Fetch orders
  const fetchOrders = useCallback(async (bustCache = false) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.branch) params.append('branch', filters.branch.toLowerCase())
      if (debouncedSearch) params.append('orderId', debouncedSearch)
      if (debouncedEmail) params.append('customerEmail', debouncedEmail)

      if (bustCache) {
        params.append('_t', Date.now().toString())
      }

      const headers = getAuthHeaders(bustCache)
      const response = await fetch(`/api/orders?${params}`, { headers })

      if (response.status === 401) {
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user-info')
        window.location.href = '/RegistrationPage'
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setOrders(data.orders || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalOrders(data.pagination?.totalOrders || 0)

    } catch (error) {
      console.error('Error fetching orders:', error)
      setError(`Failed to load orders: ${error.message}`)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [currentPage, filters.status, filters.branch, debouncedSearch, debouncedEmail])

  // Effects for data fetching
  useEffect(() => {
    setCurrentPage(1)
    fetchOrders()
  }, [filters.status, filters.branch, debouncedSearch, debouncedEmail])

  useEffect(() => {
    fetchOrders()
  }, [currentPage])

  // Manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchOrders(true)

    Swal.fire({
      icon: 'success',
      title: 'Refreshed!',
      text: 'Order data has been refreshed',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    })
  }

  // Copy order ID
  const copyOrderId = async (orderId) => {
    try {
      await navigator.clipboard.writeText(orderId)
      setCopiedOrderId(orderId)
      setTimeout(() => setCopiedOrderId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Update order status
  const handleStatusUpdate = async (orderId, newStatus, currentStatus) => {
    if (newStatus === currentStatus) return

    const result = await Swal.fire({
      title: 'Update Order Status?',
      text: `Change status from ${currentStatus} to ${newStatus}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#8B5CF6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Update',
      cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    try {
      const headers = getAuthHeaders()
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          orderId,
          status: newStatus,
          notes: `Status changed from ${currentStatus} to ${newStatus} by admin`
        })
      })

      if (response.status === 401) {
        window.location.href = '/RegistrationPage'
        return
      }

      if (!response.ok) {
        throw new Error('Failed to update order status')
      }

      setOrders(prev => prev.map(order =>
        order.orderId === orderId
          ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
          : order
      ))

      Swal.fire({
        icon: 'success',
        title: 'Status Updated!',
        text: `Order ${orderId} status changed to ${newStatus}`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      })

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Failed to update order status',
        confirmButtonColor: '#8B5CF6',
      })
    }
  }

  // Delete order
  const handleDeleteOrder = async (orderId) => {
    const result = await Swal.fire({
      title: 'Cancel Order?',
      text: 'This will cancel the order. This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, cancel it!',
      cancelButtonText: 'No, keep it'
    })

    if (result.isConfirmed) {
      try {
        const headers = getAuthHeaders()
        const response = await fetch(`/api/orders?orderId=${orderId}`, {
          method: 'DELETE',
          headers
        })

        if (response.status === 401) {
          window.location.href = '/RegistrationPage'
          return
        }

        if (!response.ok) {
          throw new Error('Failed to cancel order')
        }

        Swal.fire({
          icon: 'success',
          title: 'Order Cancelled!',
          text: 'The order has been cancelled successfully.',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        })

        await fetchOrders(true)
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Cancellation Failed',
          text: error.message || 'Failed to cancel order',
          confirmButtonColor: '#8B5CF6',
        })
      }
    }
  }

  // View order details
  const viewOrderDetails = (order) => {
    const orderItems = order.items?.map(item => `
      <div style="border-bottom: 1px solid #e5e7eb; padding: 15px 0;">
        <div style="display: flex; gap: 15px; align-items: center;">
          <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: #f3f4f6;">
            ${item.product?.images?.[0]?.url ? `<img src="${item.product.images[0].url}" style="width: 100%; height: 100%; object-fit: cover;" />` : ''}
          </div>
          <div>
            <div style="font-weight: 600;">${item.product?.name || 'Product'}</div>
            <div style="color: #6b7280;">Qty: ${item.quantity} × ৳${item.price}</div>
          </div>
        </div>
      </div>
    `).join('') || 'No items'

    Swal.fire({
      title: `Order ${order.orderId}`,
      html: `
        <div style="text-align: left; max-height: 400px; overflow-y: auto;">
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 10px; font-size: 16px; font-weight: 600;">Customer Information</h3>
            <p><strong>Name:</strong> ${order.customerName || 'N/A'}</p>
            <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
            <p><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</p>
            <p><strong>Address:</strong> ${order.shippingAddress || 'N/A'}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 10px; font-size: 16px; font-weight: 600;">Order Details</h3>
            <p><strong>Status:</strong> <span style="padding: 2px 8px; border-radius: 12px; font-size: 12px; ${getStatusStyle(order.status)}">${order.status}</span></p>
            <p><strong>Total:</strong> ৳${order.totalAmount || 0}</p>
            <p><strong>Payment:</strong> ${order.paymentMethod || 'N/A'}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>

          <div>
            <h3 style="margin-bottom: 10px; font-size: 16px; font-weight: 600;">Items</h3>
            ${orderItems}
          </div>
        </div>
      `,
      width: '600px',
      showCloseButton: true,
      confirmButtonText: 'Close',
    })
  }

  const getStatusStyle = (status) => {
    const statusObj = ORDER_STATUSES.find(s => s.value === status)
    if (statusObj) {
      const colorMap = {
        'bg-amber-100 text-amber-800': 'background: #fef3c7; color: #92400e;',
        'bg-blue-100 text-blue-800': 'background: #dbeafe; color: #1e40af;',
        'bg-purple-100 text-purple-800': 'background: #faf5ff; color: #6b21a8;',
        'bg-indigo-100 text-indigo-800': 'background: #e0e7ff; color: #3730a3;',
        'bg-green-100 text-green-800': 'background: #dcfce7; color: #166534;',
        'bg-red-100 text-red-800': 'background: #fee2e2; color: #991b1b;',
        'bg-gray-100 text-gray-800': 'background: #f3f4f6; color: #1f2937;'
      }
      return colorMap[statusObj.color] || 'background: #f3f4f6; color: #1f2937;'
    }
    return 'background: #f3f4f6; color: #1f2937;'
  }

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Orders</h1>
          <p className="text-gray-600 mt-1">View and manage all customer orders</p>
        </div>
        <motion.button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </motion.button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {ORDER_STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
            <select
              value={filters.branch}
              onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order ID</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search by order ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
            <input
              type="email"
              value={filters.customerEmail}
              onChange={(e) => setFilters(prev => ({ ...prev, customerEmail: e.target.value }))}
              placeholder="Search by email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{order.orderId}</span>
                      <button
                        onClick={() => copyOrderId(order.orderId)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        {copiedOrderId === order.orderId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.customerName}</div>
                    <div className="text-sm text-gray-500">{order.customerEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusUpdate(order.orderId, e.target.value, order.status)}
                      className={`px-2 py-1 text-xs font-medium rounded-full ${ORDER_STATUSES.find(s => s.value === order.status)?.color || 'bg-gray-100 text-gray-800'}`}
                    >
                      {ORDER_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ৳{order.totalAmount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <motion.button
                        onClick={() => viewOrderDetails(order)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDeleteOrder(order.orderId)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">Try adjusting your filters or check back later.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalOrders)} of {totalOrders} orders
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-200 rounded-l-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              return (
                <motion.button
                  key={page}
                  onClick={() => goToPage(page)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 text-sm font-medium rounded ${
                    currentPage === page
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </motion.button>
              )
            })}

            <motion.button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-200 rounded-r-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}
