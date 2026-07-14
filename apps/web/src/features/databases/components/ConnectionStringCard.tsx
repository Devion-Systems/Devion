
function ConnectionStringCard({ database }: { database: Database }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="rounded-md border p-4 font-mono text-sm">
      <code>
        {database.engine}://{database.user}:
        {revealed ? database.password : '••••••••'}
        @{database.host}:{database.port}/{database.name}
      </code>
      <button onClick={() => setRevealed(!revealed)}>
        {revealed ? 'Verbergen' : 'Anzeigen'}
      </button>
    </div>
  )
}