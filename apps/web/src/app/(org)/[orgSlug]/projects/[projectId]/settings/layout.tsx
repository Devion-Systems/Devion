"use client";

export default function ProjectsDetailSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* TODO: Horizontale Tab-Nav: General / Access / Integrations / Danger Zone */}
      {children}
    </div>
  );
}
