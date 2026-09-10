import { expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { sessionPolicy } from "./session-policy.js";

test("a retained browser cookie cannot authenticate after server-side revocation", async () => {
  const database: Record<string, any[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    baseURL: "http://localhost:3999", secret: crypto.randomUUID() + crypto.randomUUID(),
    database: memoryAdapter(database), session: sessionPolicy,
    emailAndPassword: { enabled: true },
  });
  const signup = await auth.api.signUpEmail({ body: {
    email: "revocation@example.test", name: "Test", password: crypto.randomUUID(),
  }, asResponse: true });
  expect(signup.status).toBe(200);
  const cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const headers = new Headers({ cookie });
  expect(await auth.api.getSession({ headers })).not.toBeNull();
  database.session.length = 0;
  expect(await auth.api.getSession({ headers })).toBeNull();
  expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
});
