import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { roles: { include: { role: true } } },
        });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKeys: user.roles.map((ur) => ur.role.key),
          vendorId: user.vendorId ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; roleKeys?: string[]; vendorId?: string | null };
        const t = token as Record<string, unknown>;
        t.id = u.id;
        t.roleKeys = u.roleKeys ?? [];
        t.vendorId = u.vendorId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as { id?: string; roleKeys?: string[]; vendorId?: string | null };
        const su = session.user as Record<string, unknown>;
        su.id = t.id;
        su.roleKeys = t.roleKeys ?? [];
        su.vendorId = t.vendorId ?? null;
      }
      return session;
    },
  },
};