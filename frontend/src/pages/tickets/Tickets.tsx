import { useQuery } from '@tanstack/react-query'
import { ticketsAPI } from '@/lib/api'
import { MessageSquare, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export default function Tickets() {
  const { data, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsAPI.myTickets().then(r => r.data),
  })

  const tickets = data?.items || []

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'in_progress': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-50 text-red-600'
      case 'in_progress': return 'bg-yellow-50 text-yellow-600'
      case 'resolved': return 'bg-green-50 text-green-600'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Contact our support team</p>
        </div>
        <Link to="/tickets/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No tickets yet</h3>
          <p className="text-muted-foreground mb-6">Submit a ticket and we'll get back to you</p>
          <Link to="/tickets/new">
            <Button>Create Ticket</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          {tickets.map((ticket: any) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="mt-0.5">
                  {getStatusIcon(ticket.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ticket.last_message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(ticket.created_at).toLocaleDateString()} · {ticket.replies_count || 0} replies
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}