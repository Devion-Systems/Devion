"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Membership, Organization } from "@/features/organizations/types";

type OrgContextValue = {
  org: Organization;
  membership: Membership;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  children,
  org,
  membership,
}: OrgContextValue & { children: ReactNode }) {
  return (
    <OrgContext.Provider value={{ org, membership }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOptionalOrgContext() {
  return useContext(OrgContext);
}

export function useOrgContext() {
  const context = useOptionalOrgContext();

  if (!context) {
    throw new Error(
      "useOrgContext muss innerhalb eines OrgProviders verwendet werden.",
    );
  }

  return context;
}
