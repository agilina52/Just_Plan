import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthUser } from "../auth/auth.service";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(":id")
  get(@Param("id") id: string) {
    return this.jobs.get(id);
  }

  @Get("project/:projectId")
  list(
    @Req() req: { user: AuthUser },
    @Param("projectId") projectId: string,
  ) {
    return this.jobs.listForProject(projectId, req.user.id);
  }
}
