import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function syncOAuthUser(profile: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
}) {
  if (!profile.email) throw new Error("OAuth profile missing email");
  const res = await fetch(`${API_URL}/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: profile.email,
      name: profile.name,
      image: profile.image,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ user: { id: string; email: string }; token: string }>;
}

function yandexProvider() {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    id: "yandex",
    name: "Yandex",
    type: "oauth" as const,
    authorization: {
      url: "https://oauth.yandex.ru/authorize",
      params: { scope: "login:email login:info" },
    },
    token: "https://oauth.yandex.ru/token",
    userinfo: "https://login.yandex.ru/info?format=json",
    clientId,
    clientSecret,
    profile(profile: {
      id: string;
      default_email?: string;
      emails?: string[];
      real_name?: string;
      display_name?: string;
      default_avatar_id?: string;
    }) {
      const email = profile.default_email || profile.emails?.[0] || `${profile.id}@yandex.local`;
      return {
        id: profile.id,
        name: profile.real_name || profile.display_name || "Yandex User",
        email,
        image: profile.default_avatar_id
          ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
          : null,
      };
    },
  };
}

function mailruProvider() {
  const clientId = process.env.MAILRU_CLIENT_ID;
  const clientSecret = process.env.MAILRU_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    id: "mailru",
    name: "Mail.ru",
    type: "oauth" as const,
    authorization: {
      url: "https://oauth.mail.ru/login",
      params: { scope: "userinfo" },
    },
    token: "https://oauth.mail.ru/token",
    userinfo: "https://oauth.mail.ru/userinfo",
    clientId,
    clientSecret,
    profile(profile: {
      id?: string;
      email?: string;
      name?: string;
      nickname?: string;
      image?: string;
    }) {
      return {
        id: String(profile.id ?? profile.email),
        name: profile.name || profile.nickname || "Mail.ru User",
        email: profile.email ?? `${profile.id}@mail.ru`,
        image: profile.image ?? null,
      };
    },
  };
}

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

const yandex = yandexProvider();
if (yandex) providers.push(yandex);

const mailru = mailruProvider();
if (mailru) providers.push(mailru);

// Always available for local MVP without OAuth app credentials.
providers.push(
  CredentialsProvider({
    id: "dev-login",
    name: "Dev Login",
    credentials: {},
    async authorize() {
      const res = await fetch(`${API_URL}/auth/dev-login`, { method: "POST" });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        user: { id: string; email: string; name?: string };
        token: string;
      };
      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? "Dev User",
        apiToken: data.token,
      } as { id: string; email: string; name: string; apiToken: string };
    },
  }),
);

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "dev-login") return true;
      if (!account || !user.email) return false;
      const synced = await syncOAuthUser({
        email: user.email,
        name: user.name,
        image: user.image,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      (user as { apiToken?: string; id?: string }).apiToken = synced.token;
      (user as { id?: string }).id = synced.user.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.apiToken = (user as { apiToken?: string }).apiToken;
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      (session as { apiToken?: string }).apiToken = token.apiToken as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
