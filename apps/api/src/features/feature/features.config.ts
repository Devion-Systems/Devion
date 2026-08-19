import { z } from "zod";

// Schema für ein einzelnes Feature
export const FeatureSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, {
      message: "Name darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten",
    }),
  description: z.string().max(500).optional().default(""),
  isActive: z.boolean().default(false),
});

// Schema für die Liste
export const FeaturesListSchema = z.array(FeatureSchema);

// TypeScript-Typ automatisch ableiten
export type FeatureConfig = z.infer<typeof FeatureSchema>;

// Deine Rohdaten
const rawFeatures = [
  { name: "email-service", description: "Sending Emails", isActive: false },
  {
    name: "ai-gateway",
    description: "Multi-provider AI text generation and streaming",
    isActive: false,
  },
];

// Sicher validieren und exportieren
export const defaultFeatures = FeaturesListSchema.parse(rawFeatures);
