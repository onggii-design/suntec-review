import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { refreshGoogleAccessToken } from "@/lib/google/oauth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/business.manage",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        return token;
      }

      const accessTokenExpires =
        typeof token.accessTokenExpires === "number"
          ? token.accessTokenExpires
          : 0;

      if (Date.now() < accessTokenExpires) {
        return token;
      }

      if (typeof token.refreshToken === "string") {
        try {
          token.accessToken = await refreshGoogleAccessToken(token.refreshToken);
          token.accessTokenExpires = Date.now() + 3600 * 1000;
        } catch (error) {
          console.error("Failed to refresh Google access token:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      return session;
    },
  },
};
