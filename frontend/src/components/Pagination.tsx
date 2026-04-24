interface Props {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize: (n: number) => void
}

const PAGE_SIZES = [20, 50, 100]

export function Pagination({ page, pageSize, total, onPage, onPageSize }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clamped = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (clamped - 1) * pageSize + 1
  const to = Math.min(total, clamped * pageSize)

  const pages = pageRange(clamped, totalPages)

  return (
    <div className="mt-4 flex flex-col items-start justify-between gap-3 text-[13px] text-text-muted min-[640px]:flex-row min-[640px]:items-center">
      <div>
        {from}–{to} / {total.toLocaleString()}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(clamped - 1)}
          disabled={clamped <= 1}
          className="rounded-[6px] border border-border bg-bg-base px-3 py-1.5 text-text-primary disabled:opacity-40"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-2">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={
                p === clamped
                  ? 'rounded-[6px] border border-accent-sky bg-accent-sky/[0.2] px-3 py-1.5 font-semibold text-accent-sky'
                  : 'rounded-[6px] border border-border bg-bg-base px-3 py-1.5 text-text-primary hover:border-accent-sky'
              }
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPage(clamped + 1)}
          disabled={clamped >= totalPages}
          className="rounded-[6px] border border-border bg-bg-base px-3 py-1.5 text-text-primary disabled:opacity-40"
        >
          ›
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="page-size">페이지 크기</label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-[6px] border border-border bg-bg-base px-2 py-1 text-text-primary focus:border-accent-sky focus:outline-none"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function pageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}
