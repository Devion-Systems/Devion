
type DatabaseConnectionDetails = {
  engine: string
  host: string
  port: number
  name: string
  user: string
}

/**
 * Deliberately renders only a masked connection string. Database credentials
 * must never be put into a client component's props or JavaScript payload.
 */
export function ConnectionStringCard({
  database,
}: {
  database: DatabaseConnectionDetails
}) {
  return (
    <div className="rounded-md border p-4 font-mono text-sm">
      <code>
        {database.engine}://{database.user}:
        {'••••••••'}
        @{database.host}:{database.port}/{database.name}
      </code>
    </div>
  )
}
