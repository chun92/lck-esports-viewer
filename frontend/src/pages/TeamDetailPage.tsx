import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TeamHeader } from '@/components/TeamHeader'
import { TeamHistoryTable } from '@/components/TeamHistoryTable'
import { TeamRoster } from '@/components/TeamRoster'
import { ApiError, fetchTeam } from '@/lib/api'
import type { TeamResponse } from '@/lib/team'

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: TeamResponse }
  | { kind: 'error'; message: string }

export function TeamDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  useEffect(() => {
    if (!id) {
      setStatus({ kind: 'error', message: '팀 ID가 없습니다.' })
      return
    }
    const controller = new AbortController()
    setStatus({ kind: 'loading' })
    fetchTeam(id, controller.signal)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 404) {
          setStatus({ kind: 'error', message: `팀을 찾을 수 없습니다 (id: ${id})` })
          return
        }
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        setStatus({ kind: 'error', message: msg })
      })
    return () => controller.abort()
  }, [id])

  if (status.kind === 'loading') {
    return (
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <p className="text-text-muted">Loading…</p>
      </main>
    )
  }

  if (status.kind === 'error') {
    return (
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="rounded-[10px] border border-danger/[0.35] bg-danger/[0.12] p-6 text-danger">
          {status.message}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1200px] px-8 py-12">
      <TeamHeader team={status.data} />
      <TeamRoster roster={status.data.CurrentRoster} />
      <TeamHistoryTable history={status.data.PlayerHistory} />
    </main>
  )
}
