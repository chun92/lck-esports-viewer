import { NavLink, Link } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/players', label: 'Players' },
  { to: '/teams', label: 'Teams' },
]

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg-base/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-[16px] font-bold tracking-tight text-text-primary hover:text-accent-sky"
        >
          <span className="text-accent-gold">●</span>
          LCK Viewer
        </Link>
        <nav className="flex items-center gap-1 text-[14px]">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-bg-surface font-semibold text-text-primary'
                    : 'text-text-muted hover:bg-bg-surface hover:text-text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
