import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { plansAPI } from '@/lib/api'
import { useState } from 'react'
import { LayoutGrid, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'

export default function AdminPlans() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    disk_space_mb: 10240,
    cpu_limit: 1,
    ram_limit_mb: 1024,
    swap_mb: 512,
    bandwidth_mb: 51200,
    php_version: '8.3',
    redis_enabled: false,
    woocommerce_enabled: false,
    backup_retention_days: 7,
    ssl_enabled: true,
    price: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => plansAPI.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => plansAPI.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      toast.success('Plan created successfully')
      setShowCreate(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create plan')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      plansAPI.update(id, { is_active: !is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      toast.success('Plan status updated')
    },
  })

  const plans = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hosting Plans</h1>
          <p className="text-muted-foreground mt-1">Create and manage hosting plans</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Create Plan Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Create New Plan</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g., Starter Plan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Disk Space (MB)</label>
                  <input
                    type="number"
                    value={form.disk_space_mb}
                    onChange={(e) => setForm({ ...form, disk_space_mb: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CPU Limit</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.cpu_limit}
                    onChange={(e) => setForm({ ...form, cpu_limit: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RAM (MB)</label>
                  <input
                    type="number"
                    value={form.ram_limit_mb}
                    onChange={(e) => setForm({ ...form, ram_limit_mb: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bandwidth (MB)</label>
                  <input
                    type="number"
                    value={form.bandwidth_mb}
                    onChange={(e) => setForm({ ...form, bandwidth_mb: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PHP Version</label>
                  <select
                    value={form.php_version}
                    onChange={(e) => setForm({ ...form, php_version: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="8.0">8.0</option>
                    <option value="8.1">8.1</option>
                    <option value="8.2">8.2</option>
                    <option value="8.3">8.3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Backup Retention (Days)</label>
                  <input
                    type="number"
                    value={form.backup_retention_days}
                    onChange={(e) => setForm({ ...form, backup_retention_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.redis_enabled}
                    onChange={(e) => setForm({ ...form, redis_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Redis Cache</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.woocommerce_enabled}
                    onChange={(e) => setForm({ ...form, woocommerce_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">WooCommerce</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.ssl_enabled}
                    onChange={(e) => setForm({ ...form, ssl_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Free SSL Certificate</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price ($/mo)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => (
            <div key={plan.id} className="bg-white rounded-xl border p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-1">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </div>
                <button
                  onClick={() => toggleMutation.mutate({ id: plan.id, is_active: plan.is_active })}
                  className={`p-1 rounded transition-colors ${plan.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  {plan.is_active ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disk Space</span>
                  <span className="font-medium">{(plan.disk_space_mb / 1024).toFixed(0)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU</span>
                  <span className="font-medium">{plan.cpu_limit} Core</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RAM</span>
                  <span className="font-medium">{plan.ram_limit_mb} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bandwidth</span>
                  <span className="font-medium">{(plan.bandwidth_mb / 1024).toFixed(0)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PHP</span>
                  <span className="font-medium">{plan.php_version}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                {plan.redis_enabled && <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium">Redis</span>}
                {plan.woocommerce_enabled && <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-xs font-medium">WooCommerce</span>}
                {plan.ssl_enabled && <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs font-medium">SSL</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}