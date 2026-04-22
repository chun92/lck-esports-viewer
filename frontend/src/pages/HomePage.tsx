export function HomePage() {
  return (
    <main className="mx-auto max-w-[1200px] px-8 py-12">
      <h1 className="text-[32px] font-bold">LCK Viewer</h1>
      <p className="mt-4 text-text-muted">
        선수 상세 페이지 예시:{' '}
        <a
          href="#/player/Faker"
          className="text-accent-sky underline underline-offset-4 hover:opacity-80"
        >
          /#/player/Faker
        </a>
      </p>
    </main>
  )
}
