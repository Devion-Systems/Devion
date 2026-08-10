import { Hono } from "hono";
import type { AppEnv } from "../types/env.js";

import { healthRoutes } from "./health.routes.js";
import { authRoutes } from "./auth.routes.js";
import { featureRoutes } from "./features.routes.js";
import { vmRoutes } from "./vms.routes.js";

/**
 * Central route composition.
 * All feature route groups are mounted here under their respective prefixes.
 */
const routes = new Hono<AppEnv>();

// Health checks (no /api prefix — exposed at root for probes)
routes.route("/health", healthRoutes);

// Auth (better-auth catch-all)
routes.route("/api/auth", authRoutes);

// Feature flags
routes.route("/api/features", featureRoutes);

// VM management
routes.route("/api/vms", vmRoutes);

export { routes };
