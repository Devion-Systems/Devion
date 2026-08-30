import { z } from "zod";

export const safeContainerMountPath = z.string().trim().min(1).max(512).refine(
  (value) => value.startsWith("/") && !value.includes("\0") && !value.split("/").some((part, index) => index > 0 && (part === "" || part === "." || part === "..")),
  "Mount target must be an absolute, normalized container path",
);

export const volumeMountPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/),
  target: safeContainerMountPath,
  readOnly: z.boolean().optional(),
});

export const volumeMountsPayload = z.array(volumeMountPayload).superRefine((mounts, context) => {
  const targets = new Set<string>();
  mounts.forEach((mount, index) => {
    if (targets.has(mount.target)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "target"], message: "A container mount target may be used only once" });
    targets.add(mount.target);
  });
});
