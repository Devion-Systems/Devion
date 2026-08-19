export interface RegistryCredentials { username?: string; password?: string }
export interface RegistryImage {
  image: string;
  digest: string;
  mediaType: string;
}

/** Resolves a tag to its immutable OCI manifest digest via Registry HTTP API V2. */
export async function inspectRegistryImage(image: string, credentials: RegistryCredentials = {}): Promise<RegistryImage> {
  const { registry, repository, reference } = parseImageReference(image);
  const url = `https://${registry}/v2/${repository}/manifests/${reference}`;
  const headers = new Headers({ Accept: "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json" });
  if (credentials.username && credentials.password) headers.set("Authorization", `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`);
  let response = await fetch(url, { method: "HEAD", headers, signal: AbortSignal.timeout(15_000) });
  if (response.status === 401) {
    const token = await registryBearerToken(response.headers.get("www-authenticate"), credentials);
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(url, { method: "HEAD", headers, signal: AbortSignal.timeout(15_000) });
  }
  if (!response.ok) throw new Error(`Registry manifest request failed with ${response.status}`);
  const digest = response.headers.get("docker-content-digest");
  if (!digest || !/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error("Registry did not return a valid immutable manifest digest");
  return { image, digest, mediaType: response.headers.get("content-type") ?? "application/vnd.oci.image.manifest.v1+json" };
}

async function registryBearerToken(challenge: string | null, credentials: RegistryCredentials): Promise<string> {
  if (!challenge?.toLowerCase().startsWith("bearer ")) throw new Error("Registry authentication challenge is unsupported");
  const values = Object.fromEntries([...challenge.matchAll(/([a-z]+)="([^"]*)"/gi)].map((match) => [match[1]!.toLowerCase(), match[2]!])) as Record<string, string>;
  if (!values.realm) throw new Error("Registry bearer challenge has no token realm");
  const url = new URL(values.realm);
  if (values.service) url.searchParams.set("service", values.service);
  if (values.scope) url.searchParams.set("scope", values.scope);
  const headers = new Headers();
  if (credentials.username && credentials.password) headers.set("Authorization", `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`);
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Registry token request failed with ${response.status}`);
  const payload = await response.json() as { token?: unknown; access_token?: unknown };
  const token = typeof payload.token === "string" ? payload.token : payload.access_token;
  if (typeof token !== "string" || !token) throw new Error("Registry token response is invalid");
  return token;
}

function parseImageReference(image: string): { registry: string; repository: string; reference: string } {
  const [registry, ...rest] = image.split("/");
  if (!registry || !rest.length || (!registry.includes(".") && !registry.includes(":") && registry !== "localhost")) {
    throw new Error("Deployment images must use an explicit registry host");
  }
  const path = rest.join("/");
  const digestIndex = path.indexOf("@");
  if (digestIndex >= 0) return { registry, repository: path.slice(0, digestIndex), reference: path.slice(digestIndex + 1) };
  const tagIndex = path.lastIndexOf(":");
  return tagIndex >= 0
    ? { registry, repository: path.slice(0, tagIndex), reference: path.slice(tagIndex + 1) }
    : { registry, repository: path, reference: "latest" };
}
