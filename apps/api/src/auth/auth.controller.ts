import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsOptional, IsString } from "class-validator";
import { AuthGuard } from "./auth.guard";
import { AuthService, AuthUser } from "./auth.service";

class OAuthUpsertDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  provider!: string;

  @IsString()
  providerAccountId!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("oauth")
  async oauth(@Body() body: OAuthUpsertDto) {
    return this.auth.upsertOAuthUser(body);
  }

  @Post("dev-login")
  async devLogin() {
    if (process.env.NODE_ENV === "production") {
      return { error: "disabled in production" };
    }
    return this.auth.upsertDevUser();
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return { user: req.user };
  }
}
