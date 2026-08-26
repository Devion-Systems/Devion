"use client";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { authClient } from "@/lib/auth-client";
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<
    Array<{ id: string; name?: string | null; start?: string | null }>
  >([]);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    const { data } = await authClient.apiKey.list();
    setKeys(data?.apiKeys ?? []);
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await authClient.apiKey.create({ name });
    if (error) {
      setMessage(
        error.message ?? "API-Schlüssel konnte nicht erstellt werden.",
      );
      return;
    }
    setSecret(data?.key ?? null);
    setName("");
    await load();
  }
  async function remove(id: string) {
    await authClient.apiKey.delete({ keyId: id });
    await load();
  }
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="API-Schlüssel"
        description="Erstelle Schlüssel für CLI und Automatisierung. Der vollständige Schlüssel wird nur einmal angezeigt."
      />
      <form className="flex gap-3" onSubmit={create}>
        <input
          className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-[#0b1217] px-3"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name des Schlüssels"
        />
        <Button>Schlüssel erstellen</Button>
      </form>
      {secret ? (
        <pre className="overflow-auto rounded-xl bg-amber-300/10 p-4 text-sm text-amber-100">
          {secret}
        </pre>
      ) : null}
      {message ? <p className="text-red-300">{message}</p> : null}
      <div className="space-y-2">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] p-3"
          >
            <span>{key.name || key.start || "API-Schlüssel"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void remove(key.id)}
            >
              Widerrufen
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
