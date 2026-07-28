import { useQuery } from '@tanstack/react-query'
import { dashboardAPI, usersAPI, nodesAPI } from '@/lib/api'
import { formatBytes, formatCurrency } from '@/lib/utils'
import { Users, Server, Globe, DollarSign, Activity, HardDrive, TrendingUp, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const { data: dashboard } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => dashboardAPI.getStats().then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: users } = useQuery({
    queryKey: ['admin', 'users', 'count'],
    queryFn: () => usersAPI.list({ limit: 10000 }).then(r => r.data),
  })

  const { data: nodes } = useQuery<any[]>({
    queryKey: ['admin', 'nodes'],
    queryFn: () => nodesAPI.list().then((r: any) => r.data),
  })

  const stats = [
    { title: 'Total Users', value: dashboard?.users?.total || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Active Nodes', value: dashboard?.nodes?.active || 0, icon: Server, color: 'bg-purple-50 text-purple-600' },
    { title: 'Total Websites', value: dashboard?.websites?.total || 0, icon: Globe, color: 'bg-green-50 text-green-600' },
    { title: 'Revenue', value: formatCurrency(dashboard?.revenue?.total || 0), icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'System CPU', value: `${dashboard?.nodes?.total_cpu_cores ? (dashboard?.nodes?.ram_usage_percent || 0) : 0}%`, icon: Activity, color: 'bg-orange-50 text-orange-600' },
    { title: 'Total Storage', value: formatBytes((dashboard?.nodes?.used_disk_mb || 0) * 1024 * 1024), icon: HardDrive, color: 'bg-cyan-50 text-cyan-600' },
    { title: 'Bandwidth', value: formatBytes(0), icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600' },
    { title: 'Active Alerts', value: 0, icon: AlertTriangle, color: 'bg-green-50 text-green-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">System overview and management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Nodes Status */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Server Nodes</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes?.items?.map((node: any) => (
              <div key={node.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{node.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    node.status === 'active' ? 'bg-green-50 text-green-600' :
                    node.status === 'drain' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-red-50 text-red-600'
                  }`}>{node.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">CPU</p>
                    <p className="font-medium">{node.current_cpu_usage || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RAM</p>
                    <p className="font-medium">{formatBytes((node.current_ram_usage_mb || 0) * 1024 * 1024)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Websites</p>
                    <p className="font-medium">{node.website_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Containers</p>
                    <p className="font-medium">{node.container_count || 0}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Last heartbeat: {node.last_heartbeat ? new Date(node.last_heartbeat).toLocaleString() : 'Never'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}