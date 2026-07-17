"use client";

export default function ProjectsDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Deployments / Environments / Logs / Metrics / Domains / Settings */}
      {children}
    </div>
  );
}
