async function encryptionKey() {
  const secret = process.env.ENVIRONMENT_SECRET_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Environment secret encryption key is not configured");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptEnvironmentValue(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
}

export async function decryptEnvironmentValue(value: string) {
  const [iv, ciphertext] = value.split(".");
  if (!iv || !ciphertext) throw new Error("Invalid encrypted environment variable");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64url") }, await encryptionKey(), Buffer.from(ciphertext, "base64url"));
  return new TextDecoder().decode(clear);
}
