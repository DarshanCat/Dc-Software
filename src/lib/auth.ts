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
        // @ts-expect-error custom fields
        token.id = user.id;
        // @ts-expect-error custom fields
        token.roleKeys = user.roleKeys;
        // @ts-expect-error custom fields
        token.vendorId = user.vendorId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error custom fields
        session.user.id = token.id;
        // @ts-expect-error custom fields
        session.user.roleKeys = token.roleKeys ?? [];
        // @ts-expect-error custom fields
        session.user.vendorId = token.vendorId ?? null;
      }
      return session;
    },
  },
};