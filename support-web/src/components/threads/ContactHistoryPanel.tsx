import { useQuery } from '@tanstack/react-query'
import { PhoneCall } from 'lucide-react'
import { operationsApi } from '@/api/operationsApi'

export const ContactHistoryPanel = ({ entityType, objectId }: { entityType: string; objectId: string | number }) => {
  const query = useQuery({ queryKey: ['contact-history', entityType, objectId], queryFn: () => operationsApi.getContacts(entityType, objectId), staleTime: 30_000 })
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Contact history</h2></div><div className="divide-y px-5">{query.data?.length ? query.data.map((item: any) => <div key={item.id} className="flex gap-3 py-3"><PhoneCall className="mt-0.5 h-4 w-4 text-slate-400" /><div><p className="text-sm font-medium capitalize">{item.channel} · {item.outcome.replace(/_/g, ' ')}</p><p className="text-sm text-slate-600">{item.note}</p><p className="text-xs text-slate-400">{item.created_by_name} · {new Date(item.created_at).toLocaleString()}</p></div></div>) : <p className="py-5 text-sm text-slate-500">No contact activity recorded.</p>}</div></section>
}
