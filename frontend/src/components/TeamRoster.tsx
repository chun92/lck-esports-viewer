import { Link } from 'react-router-dom'
import { fallback } from '@/lib/player'
import {
  CATEGORY_GROUPS,
  categoryGroup,
  type CategoryGroup,
  type RosterEntry,
} from '@/lib/team'

interface Props {
  roster: RosterEntry[]
}

export function TeamRoster({ roster }: Props) {
  const groups = new Map<CategoryGroup, RosterEntry[]>()
  for (const r of roster) {
    const g = categoryGroup(r.PositionCategory)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(r)
  }

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-[22px] font-bold">Current Roster</h2>
      {roster.length === 0 ? (
        <p className="text-text-muted">현재 활동 중인 선수가 없습니다.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORY_GROUPS.map(({ key, label }) => {
            const items = groups.get(key)
            if (!items || items.length === 0) return null
            return <RosterSection key={key} label={label} items={items} />
          })}
        </div>
      )}
    </section>
  )
}

function RosterSection({ label, items }: { label: string; items: RosterEntry[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[15px] font-semibold text-text-muted">{label}</h3>
      <div className="overflow-x-auto rounded-[10px] border border-border bg-bg-surface">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-border text-[12px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 text-left font-semibold">Position</th>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Player</th>
              <th className="px-4 py-3 text-left font-semibold">Join Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr
                key={`${r.Player}-${i}`}
                className="border-b border-border last:border-b-0 hover:bg-bg-base/50"
              >
                <td className="px-4 py-3">{fallback(r.Position)}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/player/${encodeURIComponent(r.Player)}`}
                    className="font-semibold text-accent-sky underline-offset-4 hover:underline"
                  >
                    {r.ID}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-muted">{fallback(r.Player)}</td>
                <td className="px-4 py-3">{fallback(r.JoinDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
