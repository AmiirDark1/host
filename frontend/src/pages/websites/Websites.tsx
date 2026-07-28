import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { websitesAPI } from '@/lib/api'
import { formatBytes, getStatusColor } from '@/lib/utils'
import { Globe, Plus, RefreshCw, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function Websites() {
  const [search, setSearch] = useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['websites'],
    queryFn: () => websitesAPI.myWebsites().then(r => r.data),
  })

  const filtered = data?.items?.filter((site: any) =>
    site.domain.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Websites</h1>
          <p className="text-muted-foreground mt-1">Manage your websites</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link to="/plans">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Website
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border p-4">
        <input
          type="text"
          placeholder="Search by domain..."
          className="w-full px-4 py-2.5 border rounded-lg bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Websites List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Globe className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No websites found</h3>
          <p className="text-muted-foreground mb-6">
            {search ? 'No websites match your search' : 'Get started by creating your first website'}
          </p>
          {!search && (
            <Link to="/plans">
              <Button>Create Website</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((site: any) => (
            <Link
              key={site.id}
              to={`/websites/${site.id}`}
              className="bg-white rounded-xl border p-6 hover:shadow-md transition-all hover:border-primary/50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(site.status)}`}>
                  {site.status}
                </span>
              </div>

              <h3 className="font-semibold truncate">{site.domain}</h3>
              <p className="text-sm text-muted-foreground mt-1">{site.plan_name || 'No plan'}</p>

              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Disk</p>
                  <p className="font-medium">{formatBytes(site.disk_usage_mb * 1024 * 1024)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPU</p>
                  <p className="font-medium">{site.cpu_usage || 0}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RAM</p>
                  <p className="font-medium">{formatBytes((site.ram_usage_mb || 0) * 1024 * 1024)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}