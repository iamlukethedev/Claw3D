export const SESSION_AUTH_POLICY = Object.freeze({
  enabled: false,
  cookieRelay: "disabled" as const,
  forwardedRequestHeaders: [] as readonly string[],
  forwardedResponseHeaders: [] as readonly string[],
  rejectedCookieAttributes: [
    "Domain",
    "Path",
    "SameSite",
    "Secure",
    "HttpOnly",
    "Expires",
    "Max-Age",
  ] as const,
  reason: "SameSite=Strict private-session cookies cannot cross origins without changing their security semantics",
});
