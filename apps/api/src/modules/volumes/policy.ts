const managedRuntimeName = /^devion-v-[a-f0-9]{32}$/;

/** Docker volume names used by managed resources are never user supplied. */
export function isManagedRuntimeName(value: string): boolean {
  return managedRuntimeName.test(value);
}

/** Reject ambiguous container mount targets before they reach Docker. */
export function isSafeMountPath(value: string): boolean {
  return value.startsWith("/") && !value.includes("\0") && !value.split("/").some(
    (part, index) => index > 0 && (part === "" || part === "." || part === ".."),
  );
}
