import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthUser } from "../auth/auth.service";
import { ProjectsService } from "./projects.service";
import type { PlanDocument } from "@just-plan/plan-schema";

class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class RenameProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class PatchPlanDto {
  @IsObject()
  patch!: Partial<PlanDocument>;

  @IsOptional()
  @IsString()
  source?: string;
}

class CommitPlanDto {
  @IsObject()
  plan!: PlanDocument;

  @IsOptional()
  @IsString()
  source?: string;
}

@Controller("projects")
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.projects.list(req.user.id);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() body: CreateProjectDto) {
    return this.projects.create(req.user.id, body.name);
  }

  @Get(":id")
  async get(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    const project = await this.projects.getOwned(id, req.user.id);
    const current = await this.projects.getCurrentPlan(id, req.user.id);
    return { project, ...current };
  }

  @Patch(":id")
  rename(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() body: RenameProjectDto,
  ) {
    return this.projects.rename(id, req.user.id, body.name);
  }

  @Delete(":id")
  remove(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.projects.remove(id, req.user.id);
  }

  @Get(":id/revisions")
  revisions(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.projects.listRevisions(id, req.user.id);
  }

  @Post(":id/plan/commit")
  commit(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() body: CommitPlanDto,
  ) {
    return this.projects.commitPlan(
      id,
      req.user.id,
      body.plan,
      body.source ?? "manual",
    );
  }

  @Post(":id/plan/patch")
  patch(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() body: PatchPlanDto,
  ) {
    return this.projects.patchPlan(
      id,
      req.user.id,
      body.patch,
      body.source ?? "manual",
    );
  }

  @Post(":id/plan/undo")
  undo(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.projects.undo(id, req.user.id);
  }
}
