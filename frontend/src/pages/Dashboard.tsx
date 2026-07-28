import { useQuery } from '@tanstack/react-query'
import { websitesAPI, monitoringAPI } from '@/lib/api'
import { formatBytes, formatCurrency, getStatusColor } from '@/lib/utils'
import {
  Globe,
  Server,
  HardDrive,
  Activity,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

function StatCard({ title, value, icon: Icon, color, subtitle }: { title: string; value: string | number; icon: any; color: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: websites, isLoading: loadingWebsites } = useQuery({
    queryKey: ['websites'],
    queryFn: () => websitesAPI.myWebsites().then(r => r.data),
  })

  const { data: monitoring } = useQuery({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => monitoringAPI.getDashboard().then(r => r.data),
    refetchInterval: 30000,
  })

  const totalSites = websites?.items?.length || 0
  const activeSites = websites?.items?.filter((s: any) => s.status === 'active').length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your hosting overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Websites"
          value={totalSites}
          icon={Globe}
          color="bg-blue-50 text-blue-600"
          subtitle={`${activeSites} active`}
        />
        <StatCard
          title="Total Storage"
          value={formatBytes(monitoring?.total_storage || 0)}
          icon={HardDrive}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="CPU Usage"
          value={`${monitoring?.cpu_usage || 0}%`}
          icon={Activity}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          title="RAM Usage"
          value={formatBytes(monitoring?.ram_usage || 0)}
          icon={Server}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Bandwidth"
          value={formatBytes(monitoring?.bandwidth || 0)}
          icon={TrendingUp}
          color="bg-cyan-50 text-cyan-600"
          subtitle="This month"
        />
        <StatCard
          title="Balance"
          value={formatCurrency(monitoring?.wallet_balance || 0)}
          icon={DollarSign}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Active Alerts"
          value={monitoring?.active_alerts || 0}
          icon={AlertTriangle}
          color={monitoring?.active_alerts > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
        />
        <StatCard
          title="System Status"
          value={monitoring?.system_status || 'Healthy'}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Recent Websites */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Recent Websites</h2>
        </div>
        <div className="p-6">
          {loadingWebsites ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : websites?.items?.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No websites yet</p>
              <p className="text-sm text-muted-foreground mt-1">Get started by purchasing a hosting plan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {websites?.items?.slice(0, 5).map((site: any) => (
                <div key={site.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{site.domain}</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(site.disk_usage_mb * 1024 * 1024)}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(site.status)}`}>
                    {site.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}