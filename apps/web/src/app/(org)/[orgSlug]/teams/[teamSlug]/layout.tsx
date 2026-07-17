"use client";

export default function TeamsDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Members / Projects / Settings */}
      {children}
    </div>
  );
}
