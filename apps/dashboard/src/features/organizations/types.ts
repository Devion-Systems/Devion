import type { Role } from "@/features/permissions/constants";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type Membership = {
  id?: string;
  organizationId?: string;
  userId?: string;
  role: Role;
};
