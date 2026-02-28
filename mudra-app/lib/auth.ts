import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { prisma } from '@/lib/prisma';

// Environment variable validation for NextAuth security
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

if (!NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET environment variable is required. Generate one with: openssl rand -base64 32'
  );
}

if (process.env.NODE_ENV === 'production' && NEXTAUTH_SECRET.length < 32) {
  throw new Error(
    'NEXTAUTH_SECRET must be at least 32 characters in production for security. Generate a secure secret with: openssl rand -base64 64'
  );
}

if (process.env.NODE_ENV === 'production' && !NEXTAUTH_URL) {
  throw new Error(
    'NEXTAUTH_URL is required in production. Set it to your full application URL (e.g., https://yourdomain.com)'
  );
}

// TypeScript module declarations for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      emailVerified?: Date | null;
    }
  }
  
  interface User {
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    emailVerified?: Date | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: NEXTAUTH_SECRET, // Explicitly set the secret for JWT signing
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() }
          });

          if (!user) {
            console.error("Auth: no user found for email", credentials.email.toLowerCase().trim());
            throw new Error("Invalid email or password");
          }

          if (!user.password) {
            console.error("Auth: user has no password (OAuth-only account)", user.id);
            throw new Error("This account uses Google sign-in. Please log in with Google.");
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            throw new Error("Invalid email or password");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          console.error("Auth error:", error);
          throw error;
        }
      }
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/welcome',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      // Block OAuth sign-in when the email already belongs to a
      // credentials-only account.  This prevents the account-takeover
      // vector that allowDangerousEmailAccountLinking used to enable.
      if (account?.provider === "google" && user?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true, password: true },
        });

        if (existing) {
          // Check whether this Google account is already linked
          const linked = await prisma.account.findFirst({
            where: {
              userId: existing.id,
              provider: "google",
            },
          });

          // Existing credentials-only user with NO linked Google account
          if (!linked && existing.password) {
            // Deny sign-in — user must log in with their password
            return `/login?error=OAuthAccountNotLinked`;
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.emailVerified = user.emailVerified;
      }
      
      // OAuth sign in
      if (account?.provider === "google") {
        token.emailVerified = new Date();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.emailVerified = (token.emailVerified as Date) ?? null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
      if (url === baseUrl || url === `${baseUrl}/login`) {
        return `${baseUrl}/dashboard`;
      }
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async createUser({ user }) {
      console.log("✅ New user created:", user.email);
      // TODO: Send welcome email
    },
    async signIn({ user, account, isNewUser }) {
      console.log("🔐 User signed in:", user.email, "via", account?.provider);
      if (isNewUser) {
        console.log("🎉 First time user!");
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
