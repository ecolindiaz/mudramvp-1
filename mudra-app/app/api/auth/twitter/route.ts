// TWITTER AUTH DISABLED - Using credentials-based auth instead
// Use /api/auth/[...nextauth] for credentials authentication

// import NextAuth from "next-auth";
// import TwitterProvider from "next-auth/providers/twitter";

// const handler = NextAuth({
//   providers: [
//     TwitterProvider({
//       clientId: process.env.TWITTER_CONSUMER_KEY!,
//       clientSecret: process.env.TWITTER_CONSUMER_SECRET!,
//       version: "1.0A",
//     }),
//   ],
//   session: {
//     strategy: "jwt",
//   },
//   callbacks: {
//     async jwt({ token, account }) {
//       if (account) {
//         token.accessToken = account.oauth_token;
//         token.accessSecret = account.oauth_token_secret;
//       }
//       return token;
//     },
//     async session({ session, token }) {
//       session.accessToken = token.accessToken as string;
//       session.accessSecret = token.accessSecret as string;
//       return session;
//     },
//   },
// });

// export { handler as GET, handler as POST };

export function GET() {
  return new Response("Twitter auth disabled", { status: 404 });
}

export function POST() {
  return new Response("Twitter auth disabled", { status: 404 });
}
