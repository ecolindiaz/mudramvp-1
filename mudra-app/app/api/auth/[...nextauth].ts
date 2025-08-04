import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { Session } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    accessSecret?: string;
  }
}

const handler = NextAuth({
  providers: [
    TwitterProvider({
      version: "1.0A",
      clientId: process.env.TWITTER_CONSUMER_KEY!,
      clientSecret: process.env.TWITTER_CONSUMER_SECRET!,
    }),
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
