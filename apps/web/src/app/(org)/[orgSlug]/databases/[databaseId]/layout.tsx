"use client";

export default function DatabasesDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Metrics / Backups / Access / Logs / Settings */}
      {children}
    </div>
  );
}
