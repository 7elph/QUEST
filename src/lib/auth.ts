import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { PASSWORD_MAX_LENGTH } from "@/lib/password-policy";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

function extractClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  }
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = headers["x-real-ip"];
  if (Array.isArray(realIp) && realIp.length > 0) {
    return realIp[0] || "unknown";
  }
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }
  return "unknown";
}

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials, req) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const ip = extractClientIp(req.headers ?? {});

        const ipLimiter = await checkRateLimit(`login:ip:${ip}`, 40, 15 * 60 * 1000);
        if (!ipLimiter.allowed) {
          return null;
        }

        const emailLimiter = await checkRateLimit(`login:email:${email}`, 20, 15 * 60 * 1000);
        if (!emailLimiter.allowed) {
          return null;
        }

        const pairLimiter = await checkRateLimit(`login:pair:${email}:${ip}`, 8, 15 * 60 * 1000);
        if (!pairLimiter.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || user.status !== UserStatus.ACTIVE) {
          return null;
        }

        const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.nick ?? user.name ?? user.email,
          role: user.role,
          adminScope: user.adminScope,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.adminScope = user.adminScope;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADVENTURER" | "PATRON" | "ADMIN";
        session.user.adminScope = token.adminScope as "SUPER_ADMIN" | "MODERATOR" | "FINANCE" | "OPS" | null;
        session.user.status = token.status as "ACTIVE" | "SUSPENDED" | "BANNED";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/home`;
    },
  },
  secret: process.env.AUTH_SECRET,
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
