import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthUser } from "../auth/auth.service";
import { AgentService } from "./agent.service";
import { checkRateLimit } from "../common/rate-limit";
import { logInfo } from "../common/logger";

class ChatDto {
  @IsString()
  @MinLength(1)
  message!: string;
}

@Controller("projects/:projectId/agent")
@UseGuards(AuthGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get("messages")
  history(
    @Req() req: { user: AuthUser },
    @Param("projectId") projectId: string,
  ) {
    return this.agent.history(projectId, req.user.id);
  }

  @Post("chat")
  chat(
    @Req() req: { user: AuthUser },
    @Param("projectId") projectId: string,
    @Body() body: ChatDto,
  ) {
    const limit = checkRateLimit(`agent:${req.user.id}`, 40, 60_000);
    if (!limit.allowed) {
      throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    logInfo("agent.chat", {
      userId: req.user.id,
      projectId,
      remaining: limit.remaining,
    });
    return this.agent.chat(projectId, req.user.id, body.message);
  }
}
