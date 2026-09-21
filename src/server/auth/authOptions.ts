import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/prisma";

/**
 * Deliberately NOT wired to GHL OAuth: the GHL connection authenticates
 * the *app* to the platform (one agency-level credential), not a
 * per-browser login. Keeping app login (this) separate from the GHL
 * install is what lets phase-2 add more `User` rows (CSM/ads/sales) with
 * their own logins against the same single GHL install, without redoing
 * the session model.
 *
 * JWT session strategy — no NextAuth Account/Session tables are needed
 * since there's no third-party OAuth login provider to link.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      // Sign-in is only allowed for emails already provisioned as a
      // GrowthOS User (created during onboarding after a GHL install).
      return Boolean(existing);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.userId = dbUser.id;
          token.agencyId = dbUser.agencyId;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.agencyId = token.agencyId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
};
