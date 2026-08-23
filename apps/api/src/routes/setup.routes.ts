import { timingSafeEqual } from "node:crypto";
import { parseEnv } from "@repo/core";
import { Hono } from "hono";
import { z } from "zod";
import { getInstallation, installSystem } from "../features/setup/service.js";
import type { AppEnv } from "../types/env.js";

const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);
const ldapUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return ["ldap:", "ldaps:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "LDAP URL must use ldap:// or ldaps://");

const setupInput = z.object({
  companyName: z.string().trim().min(2).max(100),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(48),
  administrator: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(128),
  }),
  primaryDomain: hostname.optional(),
  ldap: z
    .object({
      url: ldapUrl,
      baseDn: z.string().trim().min(3).max(512),
      bindDn: z.string().trim().max(512).optional(),
      bindPassword: z.string().max(1024).optional(),
      userSearchFilter: z.string().trim().min(3).max(512).default("(mail={{username}})"),
      groupSearchBase: z.string().trim().max(512).optional(),
      startTls: z.boolean().default(false),
    })
    .optional(),
  setupToken: z.string().max(256).optional(),
});

const setupRoutes = new Hono<AppEnv>();

setupRoutes.get("/status", async (c) => {
  const installation = await getInstallation();
  const tokenRequired = Boolean(parseEnv().DEVION_SETUP_TOKEN);
  return c.json({
    required: !installation,
    configured: Boolean(installation),
    companyName: installation?.companyName ?? null,
    primaryDomain: installation?.primaryDomain ?? null,
    ldapEnabled: installation?.ldapEnabled ?? false,
    tokenRequired,
  });
});

setupRoutes.post("/install", async (c) => {
  const parsed = setupInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      { error: "Invalid setup data", details: parsed.error.flatten().fieldErrors },
      400,
    );
  const expectedToken = parseEnv().DEVION_SETUP_TOKEN;
  if (expectedToken) {
    const actual = parsed.data.setupToken ?? "";
    const valid =
      actual.length === expectedToken.length &&
      timingSafeEqual(Buffer.from(actual), Buffer.from(expectedToken));
    if (!valid) return c.json({ error: "Invalid installation token" }, 403);
  }
  try {
    const { setupToken: _, ...installation } = parsed.data;
    const result = await installSystem(installation);
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "INSTALLATION_ALREADY_COMPLETED") {
      return c.json({ error: "System installation has already been completed" }, 409);
    }
    throw error;
  }
});

export { setupRoutes };
