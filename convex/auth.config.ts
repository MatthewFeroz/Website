// Clerk authentication config for Convex.
//
// `domain` must equal the Issuer URL of the "convex" JWT template in the Clerk
// dashboard (Configure → JWT Templates → convex → Issuer). Set it as the
// CLERK_JWT_ISSUER_DOMAIN env var on BOTH the dev and prod Convex deployments.
//
// `applicationID` must match the JWT template name in Clerk, which must be "convex".
//
// See SETUP-AUTH.md for the full setup steps.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
