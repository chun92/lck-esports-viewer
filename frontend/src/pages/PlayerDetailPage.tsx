import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CareerTimeline } from '@/components/CareerTimeline'
import { LeagueTimeline } from '@/components/LeagueTimeline'
import { PlayerHeader } from '@/components/PlayerHeader'
import { TopBar } from '@/components/TopBar'
import { ApiError, fetchPlayer } from '@/lib/api'
import { loadKnownTeams, resolveTeamInfo, type TeamLinkMap } from '@/lib/knownTeams'
import { resolveDuration, yearsMonths, type PlayerResponse } from '@/lib/player'

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: PlayerResponse }
  | { kind: 'error'; message: string }

export function PlayerDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [knownTeams, setKnownTeams] = useState<TeamLinkMap | null>(null)

  useEffect(() => {
    if (!id) {
      setStatus({ kind: 'error', message: '선수 ID가 없습니다.' })
      return
    }
    const controller = new AbortController()
    setStatus({ kind: 'loading' })

    fetchPlayer(id, controller.signal)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 404) {
          setStatus({
            kind: 'error',
            message: `선수를 찾을 수 없습니다 (id: ${id})`,
          })
          return
        }
        const msg =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        setStatus({ kind: 'error', message: msg })
      })

    let cancelled = false
    loadKnownTeams()
      .then((teams) => {
        if (!cancelled) setKnownTeams(teams)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [id])

  if (status.kind === 'loading') {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-[1200px] px-8 py-12">
          <p className="text-text-muted">Loading…</p>
        </main>
      </>
    )
  }

  if (status.kind === 'error') {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-[1200px] px-8 py-12">
          <div className="rounded-[10px] border border-danger/[0.35] bg-danger/[0.12] p-6 text-danger">
            {status.message}
          </div>
        </main>
      </>
    )
  }

  const { Player: meta, History, LeagueTimeline: timeline, LeagueTotals: totals } = status.data
  const totalDays = History.reduce((acc, t) => acc + (resolveDuration(t) ?? 0), 0)
  const teamInfo = resolveTeamInfo(knownTeams, meta.Team)

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <PlayerHeader
          meta={meta}
          career={yearsMonths(totalDays)}
          teamInfo={teamInfo}
        />
        <CareerTimeline history={History} knownTeams={knownTeams} />
        <LeagueTimeline
          timeline={timeline ?? []}
          totals={totals ?? {}}
          knownTeams={knownTeams}
        />
      </main>
    </>
  )
}
