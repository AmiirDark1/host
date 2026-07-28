import { useQuery } from '@tanstack/react-query'
import { ordersAPI } from '@/lib/api'
import { ShoppingCart, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersAPI.myOrders().then(r => r.data),
  })

  const orders = data?.items || []

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />
      case 'active': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'cancelled': return <XCircle className="h-5 w-5 text-red-500" />
      default: return <ShoppingCart className="h-5 w-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-600'
      case 'active': return 'bg-green-50 text-green-600'
      case 'cancelled': return 'bg-red-50 text-red-600'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="text-muted-foreground mt-1">View and manage your hosting orders</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No orders yet</h3>
          <p className="text-muted-foreground mb-6">Browse our hosting plans to get started</p>
          <Link to="/plans" className="text-primary hover:underline font-medium">
            View Plans
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          {orders.map((order: any) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getStatusIcon(order.status)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{order.plan_name || 'Hosting Plan'}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Order #{order.id.slice(0, 8)} · ${order.amount || 0}/mo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {order.website_id && (
                <Link
                  to={`/websites/${order.website_id}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View Site
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}