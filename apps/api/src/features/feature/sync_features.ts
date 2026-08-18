import { db, system_feature } from "@repo/db";
import { defaultFeatures } from "./features.config.js";
import { notInArray } from "drizzle-orm";

export async function syncFeaturesToDatabase() {
  console.log("🔄 Synchronisiere Standard-Features mit der Datenbank...");
  const validNames = defaultFeatures.map(f => f.name);

  if (defaultFeatures.length === 0) return;

  await db
    .insert(system_feature)
    .values(defaultFeatures)
    .onConflictDoNothing({ target: system_feature.name });

  if (validNames.length > 0) {
    await db.delete(system_feature).where(notInArray(system_feature.name, validNames));
  }
  console.log("✅ Feature-Synchronisation abgeschlossen.");
}