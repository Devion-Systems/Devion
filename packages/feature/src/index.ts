import { db,system_feature } from "@devion/core";
import { eq } from "drizzle-orm";



export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  const result = await db
    .select({ isActive: system_feature.isActive })
    .from(system_feature)
    .where(eq(system_feature.name, featureName))
    .limit(1);

  return result[0]?.isActive ?? false; 
}

export async function setFeatureStatus(name: string, active: boolean) {
  await db
    .update(system_feature)
    .set({ isActive: active })
    .where(eq(system_feature.name, name));
}

