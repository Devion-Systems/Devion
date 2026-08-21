import { Hono } from "hono";
import type { AppEnv } from "../types/env.js";
import { aiGatewayRoutes } from "./ai-gateway.routes.js";
import { adminOrganizationRoutes } from "./admin-organizations.routes.js";
import { analyticsRoutes } from "./analytics.routes.js";
import { authRoutes } from "./auth.routes.js";
import { dashboardTlsRoutes } from "./dashboard-tls.routes.js";
import { featureRoutes } from "./features.routes.js";
import { healthRoutes } from "./health.routes.js";
import { managedDatabaseRoutes } from "./managed-databases.routes.js";
import { projectRoutes } from "./projects.routes.js";
import { systemUpdateRoutes } from "./system-updates.routes.js";
import { teamRoutes } from "./teams.routes.js";
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

// Multi-provider text generation (OpenAI, Anthropic, local and compatible APIs)
routes.route("/api/ai", aiGatewayRoutes);
routes.route("/api/admin/analytics", analyticsRoutes);
routes.route("/api/admin/organizations", adminOrganizationRoutes);
routes.route("/api/admin/tls", dashboardTlsRoutes);
routes.route("/api/admin/system-updates", systemUpdateRoutes);

// Organization-scoped application resources
routes.route("/organizations", projectRoutes);
routes.route("/organizations", managedDatabaseRoutes);
routes.route("/organizations", teamRoutes);

export { routes };
