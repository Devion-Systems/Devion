/** Encrypts transient run secrets before they enter the Builder database. */
async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptRunSecrets(values: Record<string, string>, secret: string): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(Object.entries(values).map(async ([name, value]) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), new TextEncoder().encode(value));
      return [name, Buffer.from(iv).toString("base64url") + "." + Buffer.from(ciphertext).toString("base64url")];
    })),
  );
}

export async function decryptRunSecrets(values: Record<string, string>, secret: string): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(Object.entries(values).map(async ([name, value]) => {
      const [iv, ciphertext] = value.split(".");
      if (!iv || !ciphertext) throw new Error("Invalid encrypted Builder run secret");
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64url") }, await key(secret), Buffer.from(ciphertext, "base64url"));
      return [name, new TextDecoder().decode(clear)];
    })),
  );
}
