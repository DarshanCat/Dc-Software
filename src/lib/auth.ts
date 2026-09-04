import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-key-1234567890",
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

        const normalizedEmail = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { roles: { include: { role: true } } },
        });
        if (!user || !user.active) {
          const req = await prisma.registrationRequest.findFirst({
            where: { email: normalizedEmail },
            orderBy: { createdAt: "desc" },
          });
          if (req?.status === "PENDING") {
            throw new Error("Your account is awaiting administrator approval.");
          }
          if (req?.status === "REJECTED") {
            throw new Error("Your registration was not approved.");
          }
          return null;
        }

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKeys: user.roles.map((ur) => ur.role.key),
          vendorId: user.vendorId ?? null,
          mustChangePassword: user.mustChangePassword ?? false,
          passwordChangedAt: user.passwordChangedAt,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          roleKeys?: string[];
          vendorId?: string | null;
          mustChangePassword?: boolean;
          passwordChangedAt?: Date | null;
        };
        const t = token as Record<string, unknown>;
        t.id = u.id;
        t.roleKeys = u.roleKeys ?? [];
        t.vendorId = u.vendorId ?? null;
        t.mustChangePassword = u.mustChangePassword ?? false;
        t.passwordChangedAt = u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null;
      } else if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { active: true, mustChangePassword: true, passwordChangedAt: true },
        });
        if (!u || !u.active) {
          return {};
        }
        const dbPwdChangedIso = u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null;
        // If passwordChangedAt changed in DB since this JWT was issued, invalidate session
        if (token.passwordChangedAt && dbPwdChangedIso && token.passwordChangedAt !== dbPwdChangedIso) {
          return {};
        }
        (token as Record<string, unknown>).mustChangePassword = u.mustChangePassword;
        (token as Record<string, unknown>).passwordChangedAt = dbPwdChangedIso;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        return { ...session, user: undefined };
      }
      if (session.user) {
        const t = token as { id?: string; roleKeys?: string[]; vendorId?: string | null; mustChangePassword?: boolean };
        const su = session.user as Record<string, unknown>;
        su.id = t.id;
        su.roleKeys = t.roleKeys ?? [];
        su.vendorId = t.vendorId ?? null;
        su.mustChangePassword = t.mustChangePassword ?? false;
      }
      return session;
    },
  },
};