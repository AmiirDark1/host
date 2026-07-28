import { useQuery } from '@tanstack/react-query'
import { monitoringAPI } from '@/lib/api'
import { Activity, Cpu, HardDrive, Wifi, Server, Bell, AlertTriangle } from 'lucide-react'

export default function AdminMonitoring() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'monitoring', 'stats'],
    queryFn: () => monitoringAPI.getDashboard().then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: alerts } = useQuery({
    queryKey: ['admin', 'monitoring', 'alerts'],
    queryFn: () => monitoringAPI.getAlerts().then(r => r.data),
    refetchInterval: 60000,
  })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitoring</h1>
        <p className="text-muted-foreground mt-1">System monitoring and alerts</p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Cpu className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total CPU</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total_cpu || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.total_cpu_cores || 0} cores available
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total RAM</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total_ram || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.total_ram_gb ? `${stats.total_ram_gb} GB total` : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <HardDrive className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-sm text-muted-foreground">Total Disk</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total_disk || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.total_disk_gb ? `${stats.total_disk_gb} GB total` : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Wifi className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm text-muted-foreground">Bandwidth</span>
          </div>
          <p className="text-2xl font-bold">{stats?.total_bandwidth || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.total_bandwidth_gb ? `${stats.total_bandwidth_gb} GB` : 'N/A'}
          </p>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Node Health</h2>
          </div>
          <div className="space-y-3">
            {(stats?.nodes || []).map((node: any) => (
              <div key={node.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    node.healthy ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium">{node.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>CPU: {node.cpu}%</span>
                  <span>RAM: {node.ram}%</span>
                  <span>Disk: {node.disk}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Recent Alerts</h2>
          </div>
          <div className="space-y-3">
            {(alerts?.items || []).map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                  alert.severity === 'critical' ? 'text-red-500' :
                  alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!alerts?.items || alerts.items.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">No alerts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}