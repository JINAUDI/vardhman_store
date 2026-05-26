import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { getActiveAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  const metadata = user.user_metadata || {};
  return String(metadata.full_name || metadata.name || user.email || "Admin");
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  providers: [
    Google,
    GitHub,
    CredentialsProvider({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = String(credentials?.password || "");

        if (!email || !password) {
          throw new Error("Email and password are required.");
        }

        const supabase = createSupabaseServerClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          throw new Error("Email or password is incorrect.");
        }

        const adminUser = await getActiveAdminUser(data.user.id, data.user.email);
        if (!adminUser) {
          throw new Error("This account does not have dashboard access.");
        }

        return {
          id: data.user.id,
          email: normalizeEmail(data.user.email),
          name: getDisplayName(data.user),
          image: String(data.user.user_metadata?.avatar_url || ""),
          role: adminUser.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        return true;
      }

      const adminUser = await getActiveAdminUser(user.id, user.email);
      return Boolean(adminUser);
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || token.role || "admin";
        token.authUserId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = String(token.authUserId || token.sub || "");
        (session.user as { id?: string; role?: string }).role = String(token.role || "admin");
      }
      return session;
    },
  },
});