import { Sidebar } from "@/components/layout/sidebar";
import { OrgProvider } from "@/features/organizations/context/org-context";

type OrgLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const org = {
    id: orgSlug,
    slug: orgSlug,
    name: orgSlug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
  const membership = { role: "member" as const };

  return (
    <OrgProvider org={org} membership={membership}>
      <div className="flex min-h-screen">
        <Sidebar variant="org" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </OrgProvider>
  );
}
