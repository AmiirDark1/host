import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { nodesAPI } from '@/lib/api'
import { Server, Activity, Cpu, HardDrive, Wifi, Plus, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import NodeTerminal from '@/components/terminal/NodeTerminal'

export default function AdminNodes() {
  const queryClient = useQueryClient()
  const [terminalNode, setTerminalNode] = useState<{ id: string; name: string; host: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'nodes'],
    queryFn: () => nodesAPI.list().then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      nodesAPI.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'nodes'] })
      toast.success('Node status updated')
    },
  })

  const nodes = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Server Nodes</h1>
          <p className="text-muted-foreground mt-1">Manage your remote server nodes</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Node
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Server className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No nodes added yet</h3>
          <p className="text-muted-foreground mb-6">Add your first remote server node to start hosting websites</p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {nodes.map((node: any) => (
            <div key={node.id} className="bg-white rounded-xl border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    node.status === 'active' ? 'bg-green-50' :
                    node.status === 'drain' ? 'bg-yellow-50' :
                    node.status === 'maintenance' ? 'bg-orange-50' : 'bg-red-50'
                  }`}>
                    <Server className={`h-5 w-5 ${
                      node.status === 'active' ? 'text-green-600' :
                      node.status === 'drain' ? 'text-yellow-600' :
                      node.status === 'maintenance' ? 'text-orange-600' : 'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{node.name}</h3>
                    <p className="text-sm text-muted-foreground">{node.host}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    node.status === 'active' ? 'bg-green-50 text-green-600' :
                    node.status === 'drain' ? 'bg-yellow-50 text-yellow-600' :
                    node.status === 'maintenance' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {node.status}
                  </span>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">CPU</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{node.current_cpu_usage || 0}%</span>
                    <span className="text-xs text-muted-foreground">{node.cpu_cores || '?'} cores</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((node.current_cpu_usage || 0), 100)}%` }} />
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">RAM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{node.current_ram_usage || 0}%</span>
                    <span className="text-xs text-muted-foreground">{node.ram_total_mb ? `${(node.ram_total_mb / 1024).toFixed(0)} GB` : '?'}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min((node.current_ram_usage || 0), 100)}%` }} />
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Disk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{node.current_disk_usage || 0}%</span>
                    <span className="text-xs text-muted-foreground">{node.disk_total_mb ? `${(node.disk_total_mb / 1024).toFixed(0)} GB` : '?'}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min((node.current_disk_usage || 0), 100)}%` }} />
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Bandwidth</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{node.current_bandwidth_usage || 0}%</span>
                    <span className="text-xs text-muted-foreground">{node.bandwidth_total_mb ? `${(node.bandwidth_total_mb / 1024).toFixed(0)} GB` : '?'}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min((node.current_bandwidth_usage || 0), 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm border-t pt-4">
                <div>
                  <span className="text-muted-foreground">Containers: </span>
                  <span className="font-medium">{node.container_count || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Websites: </span>
                  <span className="font-medium">{node.website_count || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Heartbeat: </span>
                  <span className={`font-medium ${node.last_heartbeat ? 'text-green-600' : 'text-red-600'}`}>
                    {node.last_heartbeat ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setTerminalNode({ id: node.id, name: node.name, host: node.host })}
                >
                  <Terminal className="h-4 w-4 mr-1.5" />
                  SSH Connect
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate({ id: node.id, status: 'drain' })}>
                  Drain
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate({ id: node.id, status: 'maintenance' })}>
                  Maintenance
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SSH Terminal Modal */}
      {terminalNode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <NodeTerminal
              nodeId={terminalNode.id}
              nodeName={terminalNode.name}
              nodeHost={terminalNode.host}
              onClose={() => setTerminalNode(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}