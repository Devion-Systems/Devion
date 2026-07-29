import { AsyncLocalStorage } from "node:async_hooks";

export type Brand<T, K extends string> = T & { readonly __brand: K };

export type UserId = Brand<string, "UserId">;
export type TenantId = Brand<string, "TenantId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type TeamId = Brand<string, "TeamId">;
export type RequestId = Brand<string, "RequestId">;
export type TraceId = Brand<string, "TraceId">;

export interface RequestContextPayload {
  requestId: RequestId;
  traceId?: TraceId;
  tenantId?: TenantId;
  organizationId?: OrganizationId;
  userId?: UserId;
  environment: "development" | "test" | "staging" | "production";
}

// Enterprise Feature: Async Local Storage Context Store
export const requestContextStorage = new AsyncLocalStorage<RequestContextPayload>();

export function getRequestContext(): RequestContextPayload | undefined {
  return requestContextStorage.getStore();
}

export function runWithContext<R>(context: RequestContextPayload, fn: () => R): R {
  return requestContextStorage.run(context, fn);
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}