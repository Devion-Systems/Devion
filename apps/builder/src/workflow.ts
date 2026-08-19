import { createHash } from "node:crypto";
import { parse } from "yaml";
import { type Workflow, type WorkflowStep, workflowSchema } from "./domain.ts";

export interface WorkflowValidation {
  valid: boolean;
  workflow: Workflow | null;
  checksum: string | null;
  errors: Array<{ path: string; message: string }>;
}

export function validateWorkflow(value: unknown): WorkflowValidation {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? parse(value) : value;
  } catch (error) {
    return { valid: false, workflow: null, checksum: null, errors: [{ path: "$", message: String(error) }] };
  }
  const result = workflowSchema.safeParse(parsed);
  if (!result.success) {
    return {
      valid: false,
      workflow: null,
      checksum: null,
      errors: result.error.issues.map((issue) => ({ path: issue.path.join(".") || "$", message: issue.message })),
    };
  }
  const errors = validateGraph(result.data.steps);
  if (errors.length) return { valid: false, workflow: null, checksum: null, errors };
  const json = canonicalize(result.data);
  return {
    valid: true,
    workflow: result.data,
    checksum: `sha256:${createHash("sha256").update(json).digest("hex")}`,
    errors: [],
  };
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateGraph(steps: WorkflowStep[]): WorkflowValidation["errors"] {
  const errors: WorkflowValidation["errors"] = [];
  const ids = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (ids.has(step.id)) errors.push({ path: `steps.${index}.id`, message: "Duplicate step ID" });
    ids.add(step.id);
  }
  const graph = new Map(steps.map((step) => [step.id, step.needs]));
  for (const [index, step] of steps.entries()) {
    for (const dependency of step.needs) {
      if (!ids.has(dependency)) errors.push({ path: `steps.${index}.needs`, message: `Unknown step: ${dependency}` });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (visiting.has(id)) {
      errors.push({ path: "steps", message: `Dependency cycle: ${[...path, id].join(" -> ")}` });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) if (graph.has(dependency)) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id, []);
  return errors;
}

export function interpolate(value: string, context: Record<string, string>): string {
  return value.replace(/\$\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => context[key] ?? "");
}
