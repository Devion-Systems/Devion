"use client";

import { useState } from "react";

export type DatabaseConnection = {
  engine: string;
  user: string;
  password: string;
  host: string;
  port: number;
  name: string;
};

export function ConnectionStringCard({
  database,
}: {
  database: DatabaseConnection;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-md border p-4 font-mono text-sm">
      <code>
        {database.engine}://{database.user}:
        {revealed ? database.password : "••••••••"}@{database.host}:
        {database.port}/{database.name}
      </code>
      <button type="button" onClick={() => setRevealed(!revealed)}>
        {revealed ? "Verbergen" : "Anzeigen"}
      </button>
    </div>
  );
}
