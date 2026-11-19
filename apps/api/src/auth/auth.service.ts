import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private get secret() {
    return process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret";
  }

  signToken(user: AuthUser): string {
    return jwt.sign(
      { sub: user.id, email: user.email, name: user.name, image: user.image },
      this.secret,
      { expiresIn: "7d" },
    );
  }

  verifyToken(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.secret) as jwt.JwtPayload;
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException("Invalid token payload");
      }
      return {
        id: String(payload.sub),
        email: String(payload.email),
        name: (payload.name as string | undefined) ?? null,
        image: (payload.image as string | undefined) ?? null,
      };
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  async upsertOAuthUser(input: {
    email: string;
    name?: string | null;
    image?: string | null;
    provider: string;
    providerAccountId: string;
  }): Promise<{ user: AuthUser; token: string }> {
    const email = input.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: input.name ?? null,
          image: input.image ?? null,
        },
      });
    } else if (input.name || input.image) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: input.name ?? user.name,
          image: input.image ?? user.image,
        },
      });
    }

    const existing = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
    });
    if (!existing) {
      await this.prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
    return { user: authUser, token: this.signToken(authUser) };
  }

  /** Dev-only helper when OAuth apps are not configured. */
  async upsertDevUser(email = "dev@justplan.local"): Promise<{
    user: AuthUser;
    token: string;
  }> {
    return this.upsertOAuthUser({
      email,
      name: "Dev User",
      image: null,
      provider: "dev",
      providerAccountId: "dev-1",
    });
  }
}
