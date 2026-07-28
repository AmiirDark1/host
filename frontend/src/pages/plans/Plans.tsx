import { useQuery } from '@tanstack/react-query'
import { plansAPI } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { Server, HardDrive, Database, Globe, Wifi, Shield, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function Plans() {
  const { data, isLoading } = useQuery({
    queryKey: ['plans', 'public'],
    queryFn: () => plansAPI.getPublic().then(r => r.data),
  })

  const plans = data?.items || []

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto py-8">
        <h1 className="text-3xl font-bold">Choose Your Hosting Plan</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Everything you need to launch and manage your WordPress websites
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Server className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No plans available</h2>
          <p className="text-muted-foreground">Check back later for available hosting plans</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => (
            <div
              key={plan.id}
              className="bg-white rounded-xl border hover:shadow-lg transition-all relative group"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {plan.is_popular && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold mb-6">
                  ${plan.price}<span className="text-lg text-muted-foreground font-normal">/mo</span>
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-blue-50">
                      <HardDrive className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm">{formatBytes(plan.disk_space_mb * 1024 * 1024)} Storage</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-green-50">
                      <Database className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm">{formatBytes(plan.ram_limit_mb * 1024 * 1024)} RAM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-orange-50">
                      <Server className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="text-sm">{plan.cpu_limit} CPU Cores</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-purple-50">
                      <Globe className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm">{plan.websites_limit || 1} Website{(plan.websites_limit || 1) > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-cyan-50">
                      <Wifi className="h-4 w-4 text-cyan-600" />
                    </div>
                    <span className="text-sm">{formatBytes(plan.bandwidth_mb * 1024 * 1024)} Bandwidth</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-emerald-50">
                      <Shield className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-sm">{plan.backup_retention_days} Day Backup</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {plan.ssl_enabled && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500" />
                      Free SSL Certificate
                    </div>
                  )}
                  {plan.redis_enabled && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500" />
                      Redis Cache
                    </div>
                  )}
                  {plan.woocommerce_enabled && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500" />
                      WooCommerce Support
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    {plan.sftp_users} SFTP Users
                  </div>
                </div>

                <Link to={`/orders/new?plan_id=${plan.id}`}>
                  <Button className="w-full group">
                    Get Started
                    <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}