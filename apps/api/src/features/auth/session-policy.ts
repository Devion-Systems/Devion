/** Control-plane access must observe server-side revocation on the next request. */
export const sessionPolicy = { cookieCache: { enabled: false } } as const;
