"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileKey2,
  Loader2,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type CertificateStatus = {
  installed: boolean;
  subject?: string;
  subjectAltName?: string;
  validFrom?: string;
  validTo?: string;
  fingerprint256?: string;
};

function apiUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
}

export default function AdminCertificatesPage() {
  const queryClient = useQueryClient();
  const [certificate, setCertificate] = useState<File | null>(null);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = useQuery<CertificateStatus>({
    queryKey: ["admin", "tls", "certificate"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/admin/tls/certificate"), {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("TLS-Status konnte nicht geladen werden.");
      return response.json();
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!certificate || !privateKey)
        throw new Error("Zertifikat und Private Key auswählen.");
      const formData = new FormData();
      formData.set("certificate", certificate);
      formData.set("privateKey", privateKey);
      const response = await fetch(apiUrl("/api/admin/tls/certificate"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error ?? "Zertifikat konnte nicht installiert werden.",
        );
      }
    },
    onSuccess: () => {
      setCertificate(null);
      setPrivateKey(null);
      setError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "tls", "certificate"],
      });
    },
    onError: (uploadError: Error) => setError(uploadError.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Dashboard TLS-Zertifikat"
        description="Installiert ein PEM-Zertifikat für die Hauptdomain des Dashboards in Traefik."
      />

      <section className="rounded-xl border border-white/[0.07] bg-[#1e272e] p-5">
        <div className="flex items-center gap-3">
          {status.data?.installed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <LockKeyhole className="h-5 w-5 text-amber-400" />
          )}
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {status.data?.installed
                ? "Zertifikat installiert"
                : "Kein Zertifikat installiert"}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {status.data?.installed
                ? "Traefik lädt das Zertifikat aus dem geschützten Zertifikatsspeicher."
                : "Nutze ACME oder lade ein PEM-Zertifikat mit zugehörigem Key hoch."}
            </p>
          </div>
        </div>
        {status.data?.installed && (
          <dl className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Betreff</dt>
              <dd className="mt-1 break-all font-mono text-zinc-200">
                {status.data.subject}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Gültig bis</dt>
              <dd className="mt-1 text-zinc-200">
                {status.data.validTo
                  ? new Date(status.data.validTo).toLocaleString("de-DE")
                  : "–"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">SHA-256 Fingerprint</dt>
              <dd className="mt-1 break-all font-mono text-zinc-300">
                {status.data.fingerprint256}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-[#0984e3]/25 bg-[#0984e3]/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-[#00cec9]" />
          <h2 className="text-sm font-semibold text-zinc-100">
            PEM-Zertifikat installieren
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-zinc-300">
            Zertifikat / Chain (.pem, .crt)
            <input
              type="file"
              accept=".pem,.crt,application/x-pem-file"
              onChange={(event) =>
                setCertificate(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-zinc-200"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Private Key (.pem, .key)
            <input
              type="file"
              accept=".pem,.key,application/x-pem-file"
              onChange={(event) =>
                setPrivateKey(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full text-xs text-zinc-500 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-zinc-200"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <FileKey2 className="h-3.5 w-3.5" />
            Der Private Key bleibt auf dem Server und wird nicht angezeigt.
          </p>
          <Button
            size="sm"
            onClick={() => upload.mutate()}
            disabled={upload.isPending || !certificate || !privateKey}
          >
            {upload.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Installieren
          </Button>
        </div>
      </section>
    </div>
  );
}
