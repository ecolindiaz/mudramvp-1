import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { Session } from "next-auth";

// Extend the Session type to include accessToken
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    accessSecret?: string;
  }
}


export default NextAuth({
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CONSUMER_KEY || "",
      clientSecret: process.env.TWITTER_CONSUMER_SECRET || "",
      version: "1.0A", // Twitter OAuth 1.0A
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }: { token: any; account?: any }) {
      if (account) {
        token.accessToken = account.oauth_token;
        token.accessSecret = account.oauth_token_secret;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.accessToken = token.accessToken;
      session.accessSecret = token.accessSecret;
      return session;
    },
  },
});
