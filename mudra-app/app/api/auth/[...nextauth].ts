import NextAuth from "next-auth";
// import TwitterProvider from "next-auth/providers/twitter";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Session } from "next-auth";

const prisma = new PrismaClient();

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    accessSecret?: string;
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { name: credentials.username },
                { email: credentials.username },
                { email: `${credentials.username}@mudra.app` }
              ]
            }
          });

          if (!user || !(user as any).password) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, (user as any).password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    }),
    // TwitterProvider({
    //   version: "1.0A",
    //   clientId: process.env.TWITTER_CONSUMER_KEY!,
    //   clientSecret: process.env.TWITTER_CONSUMER_SECRET!,
    // }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.oauth_token;
        token.accessSecret = account.oauth_token_secret;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.accessSecret = token.accessSecret as string | undefined;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
