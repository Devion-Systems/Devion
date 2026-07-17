"use client";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* TODO: Lädt Org + Membership via useOrgBySlug/useCurrentMembership, rendert Sidebar + OrgProvider (siehe Next.js-Doku-Abschnitt zu use client) */}
      {children}
    </div>
  );
}
