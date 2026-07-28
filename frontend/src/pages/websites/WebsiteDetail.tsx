import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { websitesAPI } from '@/lib/api'
import { formatBytes, getStatusColor } from '@/lib/utils'
import { Globe, ArrowLeft, Terminal, Database, Lock, Activity, HardDrive, RefreshCw, Play, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

export default function WebsiteDetail() {
  const { id } = useParams()
  const { data: website, isLoading, refetch } = useQuery({
    queryKey: ['website', id],
    queryFn: () => websitesAPI.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const handleAction = async (action: string) => {
    try {
      await websitesAPI.action(id!, action)
      toast.success(`Website ${action}ed successfully`)
      refetch()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || `Failed to ${action} website`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!website) {
    return (
      <div className="text-center py-12">
        <Globe className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Website not found</h2>
        <Link to="/websites" className="text-primary hover:underline">Back to websites</Link>
      </div>
    )
  }

  const actions = [
    { label: 'Start', action: 'start', icon: Play, color: 'bg-green-50 text-green-600 hover:bg-green-100' },
    { label: 'Stop', action: 'stop', icon: Square, color: 'bg-red-50 text-red-600 hover:bg-red-100' },
    { label: 'Restart', action: 'restart', icon: RefreshCw, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
    { label: 'Delete', action: 'delete', icon: Trash2, color: 'bg-red-50 text-red-600 hover:bg-red-100' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/websites" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{website.domain}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(website.status)}`}>
                {website.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">Created {new Date(website.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {actions.map(({ label, action, icon: Icon, color }) => (
          <Button
            key={action}
            variant="outline"
            className={`${color} border-0`}
            onClick={() => handleAction(action)}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <HardDrive className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disk Usage</p>
              <p className="font-semibold">{formatBytes(website.disk_usage_mb * 1024 * 1024)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50">
              <Activity className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CPU Usage</p>
              <p className="font-semibold">{website.cpu_usage || 0}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RAM Usage</p>
              <p className="font-semibold">{formatBytes((website.ram_usage_mb || 0) * 1024 * 1024)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Lock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SSL Status</p>
              <p className="font-semibold">{website.ssl_status || 'No SSL'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Website Details</h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <dt className="text-sm text-muted-foreground">Domain</dt>
              <dd className="font-medium mt-1">{website.domain}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Plan</dt>
              <dd className="font-medium mt-1">{website.plan_name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Node</dt>
              <dd className="font-medium mt-1">{website.node_name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">PHP Version</dt>
              <dd className="font-medium mt-1">{website.php_version || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">MySQL Database</dt>
              <dd className="font-medium mt-1">{website.mysql_database || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">MySQL User</dt>
              <dd className="font-medium mt-1">{website.mysql_user || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">WordPress Admin</dt>
              <dd className="font-medium mt-1">{website.wp_admin_user || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Admin Email</dt>
              <dd className="font-medium mt-1">{website.wp_admin_email || 'N/A'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Directory & Container Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Directory</h2>
          </div>
          <div className="p-6">
            <code className="text-sm bg-gray-100 px-3 py-2 rounded block">{website.directory}</code>
          </div>
        </div>
        <div className="bg-white rounded-xl border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Container</h2>
          </div>
          <div className="p-6">
            <code className="text-sm bg-gray-100 px-3 py-2 rounded block">{website.container_id || 'N/A'}</code>
          </div>
        </div>
      </div>
    </div>
  )
}