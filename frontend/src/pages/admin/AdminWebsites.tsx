import { useQuery } from '@tanstack/react-query'
import { websitesAPI } from '@/lib/api'
import { Globe, Search, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function AdminWebsites() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'websites'],
    queryFn: () => websitesAPI.list().then(r => r.data),
  })

  const websites = data?.items || []
  const filtered = websites.filter((w: any) =>
    w.domain?.toLowerCase().includes(search.toLowerCase()) ||
    w.plan_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Websites</h1>
          <p className="text-muted-foreground mt-1">Manage all hosted websites</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search websites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-sm">Domain</th>
                <th className="text-left p-4 font-medium text-sm">Plan</th>
                <th className="text-left p-4 font-medium text-sm">Node</th>
                <th className="text-left p-4 font-medium text-sm">Owner</th>
                <th className="text-left p-4 font-medium text-sm">Status</th>
                <th className="text-left p-4 font-medium text-sm">SSL</th>
                <th className="text-left p-4 font-medium text-sm">Created</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((site: any) => (
                <tr key={site.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Link to={`/websites/${site.id}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Globe className="h-4 w-4" />
                      {site.domain}
                    </Link>
                  </td>
                  <td className="p-4 text-sm">{site.plan_name || 'N/A'}</td>
                  <td className="p-4 text-sm">{site.node_name || 'N/A'}</td>
                  <td className="p-4 text-sm">{site.user_email || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      site.status === 'active' ? 'bg-green-50 text-green-600' :
                      site.status === 'suspended' ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {site.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      site.ssl_status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {site.ssl_status || 'None'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(site.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}