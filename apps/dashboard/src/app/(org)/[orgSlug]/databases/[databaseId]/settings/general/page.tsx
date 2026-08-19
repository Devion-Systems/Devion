"use client";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
export default function DatabasesDetailSettingsGeneralPage() {
  const { orgSlug, databaseId } = useParams<{
    orgSlug: string;
    databaseId: string;
  }>();
  const [maintenanceWindow, setMaintenanceWindow] =
    useState("Sunday 02:00 UTC");
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${databaseId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceWindow }),
      },
    );
    setMessage(
      response.ok
        ? "Einstellungen gespeichert."
        : "Einstellungen konnten nicht gespeichert werden.",
    );
  }
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Datenbankeinstellungen"
        description="Wartungsfenster und allgemeine Konfiguration dieser Datenbank."
      />
      <form
        className="max-w-2xl space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-6"
        onSubmit={submit}
      >
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="maintenance-window"
        >
          Wartungsfenster
          <input
            id="maintenance-window"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            value={maintenanceWindow}
            onChange={(event) => setMaintenanceWindow(event.target.value)}
          />
        </label>
        {message ? <p className="text-sm text-[#81ecec]">{message}</p> : null}
        <Button type="submit">Speichern</Button>
      </form>
    </div>
  );
}
