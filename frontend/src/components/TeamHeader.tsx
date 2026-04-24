import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fallback } from '@/lib/player'
import type { TeamResponse } from '@/lib/team'

interface Props {
  team: TeamResponse
}

export function TeamHeader({ team }: Props) {
  const [logoBroken, setLogoBroken] = useState(false)

  return (
    <section className="mb-10 border-b border-border pb-8">
      {team.RenamedTo && (
        <div className="mb-4 rounded-[10px] border border-accent-gold/[0.35] bg-accent-gold/[0.12] px-4 py-3 text-[14px] text-accent-gold">
          현재는{' '}
          <Link
            to={`/team/${encodeURIComponent(team.RenamedTo)}`}
            className="font-semibold underline-offset-4 hover:underline"
          >
            {team.RenamedTo}
          </Link>{' '}
          로 이름이 변경되었습니다.
        </div>
      )}

      <div className="flex flex-col gap-6 min-[720px]:flex-row min-[720px]:items-center">
        <div className="flex h-[128px] w-[128px] shrink-0 items-center justify-center rounded-[12px] border border-border bg-bg-surface">
          {team.LogoUrl && !logoBroken ? (
            <img
              src={team.LogoUrl}
              alt={`${team.Name} logo`}
              className="max-h-[112px] max-w-[112px] object-contain"
              onError={() => setLogoBroken(true)}
              loading="lazy"
            />
          ) : (
            <span className="text-[24px] font-bold text-text-muted">
              {team.Short || '?'}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[48px] font-extrabold leading-none tracking-[-0.01em]">
            {fallback(team.Name)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px] text-text-muted">
            {team.Short && (
              <span className="inline-flex items-center rounded-full border border-accent-sky/[0.35] bg-accent-sky/[0.12] px-3 py-1 text-[13px] font-semibold text-accent-sky">
                {team.Short}
              </span>
            )}
            <span>{fallback(team.Region)}</span>
            <span className="text-border">·</span>
            {team.IsDisbanded ? (
              <span className="inline-flex items-center rounded-full border border-danger/[0.35] bg-danger/[0.12] px-3 py-0.5 text-[12px] font-semibold text-danger">
                Disbanded
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-success/[0.4] bg-success/[0.12] px-3 py-0.5 text-[12px] font-semibold text-success">
                Active
              </span>
            )}
          </div>

          {(team.Predecessors.length > 0 || team.FormerNames.length > 0) && (
            <div className="mt-4 text-[13px] text-text-muted">
              <span className="mr-2">이전 이름:</span>
              {team.Predecessors.map((p, i) => (
                <span key={`p-${p}`}>
                  {i > 0 && <span className="mx-1 text-border">·</span>}
                  <Link
                    to={`/team/${encodeURIComponent(p)}`}
                    className="text-accent-sky underline-offset-4 hover:underline"
                  >
                    {p}
                  </Link>
                </span>
              ))}
              {team.FormerNames.map((n, i) => (
                <span key={`f-${n}`}>
                  {(team.Predecessors.length > 0 || i > 0) && (
                    <span className="mx-1 text-border">·</span>
                  )}
                  <span>{n}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
