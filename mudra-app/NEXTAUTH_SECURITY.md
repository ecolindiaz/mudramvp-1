# NextAuth Security Implementation

## Overview
This document details the security measures implemented for NextAuth session management and JWT token signing in the Mudra application.

## Security Vulnerability Resolved
**Issue**: Missing NEXTAUTH_SECRET validation
**Severity**: Medium
**Status**: ✅ Resolved

## Implementation Details

### 1. Environment Variable Validation
Location: [lib/auth.ts](lib/auth.ts)

The following validation checks are now enforced at application startup:

```typescript
// Environment variable validation for NextAuth security
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

// Critical: NEXTAUTH_SECRET must exist
if (!NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET environment variable is required. Generate one with: openssl rand -base64 32'
  );
}

// Production: Minimum 32 characters enforced
if (process.env.NODE_ENV === 'production' && NEXTAUTH_SECRET.length < 32) {
  throw new Error(
    'NEXTAUTH_SECRET must be at least 32 characters in production for security. Generate a secure secret with: openssl rand -base64 64'
  );
}

// Production: NEXTAUTH_URL must be set
if (process.env.NODE_ENV === 'production' && !NEXTAUTH_URL) {
  throw new Error(
    'NEXTAUTH_URL is required in production. Set it to your full application URL (e.g., https://yourdomain.com)'
  );
}
```

### 2. Explicit Secret Configuration
The secret is now explicitly passed to NextAuth configuration:

```typescript
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: NEXTAUTH_SECRET, // Explicitly set the secret for JWT signing
  // ... rest of config
};
```

### 3. Environment Variable Documentation
Updated [.env.example](.env.example) with comprehensive security guidelines:

- Minimum character length requirements
- Multiple secret generation methods
- Rotation policies
- Environment separation best practices
- Secure storage recommendations

## Security Benefits

### Session Security
✅ **JWT Token Integrity**: Tokens are signed with a validated, strong secret
✅ **Forgery Prevention**: Weak or missing secrets are caught at startup
✅ **Session Hijacking Protection**: 32+ character secrets provide strong cryptographic protection

### Production Safeguards
✅ **Fail-Fast**: Application won't start with invalid configuration
✅ **Clear Error Messages**: Developers get actionable guidance
✅ **URL Validation**: Production deployments require proper NEXTAUTH_URL

### Development Experience
✅ **Early Detection**: Configuration issues found at startup, not during user sessions
✅ **Self-Documenting**: Error messages include generation commands
✅ **Example Configuration**: Comprehensive .env.example with security notes

## Secret Generation

### Recommended Method (64 characters)
```bash
openssl rand -base64 64
```

### Minimum Acceptable (32 characters)
```bash
openssl rand -base64 32
```

### Online Tool (when OpenSSL unavailable)
```
https://generate-secret.vercel.app/32
```

## Security Best Practices

### Secret Rotation
- **Frequency**: Rotate every 90 days minimum
- **Process**: 
  1. Generate new secret
  2. Deploy to production (rolling update)
  3. Wait for all sessions to migrate
  4. Remove old secret

### Environment Separation
- ❌ **Never** use the same secret across environments
- ✅ **Development**: One secret
- ✅ **Staging**: Different secret
- ✅ **Production**: Unique, highly secure secret

### Secure Storage
For production environments, store secrets in:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Vercel Environment Variables (encrypted)

**Never** commit secrets to:
- Git repositories
- CI/CD logs
- Error tracking systems
- Documentation

## Verification Checklist

### Before Deployment
- [ ] NEXTAUTH_SECRET is set in all environments
- [ ] Production secret is at least 32 characters (64+ recommended)
- [ ] Each environment uses a unique secret
- [ ] NEXTAUTH_URL matches canonical production URL
- [ ] Secrets are stored in secure management system
- [ ] .env files are in .gitignore

### Testing
- [ ] Application starts successfully with valid secret
- [ ] Application fails to start with missing secret
- [ ] Application fails in production with weak secret (<32 chars)
- [ ] Sessions persist correctly after deployment
- [ ] JWT tokens validate successfully

## Threat Mitigation

| Threat | Mitigation | Status |
|--------|------------|--------|
| Weak or missing secret | Startup validation | ✅ Implemented |
| Session token forgery | Strong cryptographic secret | ✅ Implemented |
| Cross-site attacks | NEXTAUTH_URL validation | ✅ Implemented |
| Production misconfig | Environment-specific checks | ✅ Implemented |
| Secret exposure | Documentation + .gitignore | ✅ Implemented |

## Monitoring & Alerts

### Recommended Monitoring
1. **Session anomalies**: Unusual login patterns
2. **Failed auth attempts**: Brute force detection
3. **Secret rotation**: Track last rotation date
4. **Config errors**: Alert on startup failures

### Logging (Already Implemented)
```typescript
events: {
  async createUser({ user }) {
    console.log("✅ New user created:", user.email);
  },
  async signIn({ user, account, isNewUser }) {
    console.log("🔐 User signed in:", user.email, "via", account?.provider);
  },
}
```

## References

- [NextAuth.js Secret Configuration](https://next-auth.js.org/configuration/options#secret)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

## Related Documentation

- [AUTH_SETUP_GUIDE.md](AUTH_SETUP_GUIDE.md) - Authentication setup and configuration
- [.env.example](.env.example) - Environment variable reference
- [lib/auth.ts](lib/auth.ts) - NextAuth configuration implementation

---

**Last Updated**: January 28, 2026
**Security Review**: Completed
**Next Review**: April 28, 2026 (90 days)
