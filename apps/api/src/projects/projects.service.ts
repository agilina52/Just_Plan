import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  emptyPlan,
  PlanDocument,
  PlanDocumentSchema,
  applyPlanPatch,
} from "@just-plan/plan-schema";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async create(ownerId: string, name: string) {
    const project = await this.prisma.project.create({
      data: { ownerId, name },
    });
    const plan = emptyPlan({
      meta: {
        sourceImageId: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await this.prisma.planRevision.create({
      data: {
        projectId: project.id,
        version: 1,
        document: JSON.stringify(plan),
        source: "system",
      },
    });
    return project;
  }

  async getOwned(projectId: string, ownerId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException("Project not found");
    if (project.ownerId !== ownerId) {
      throw new ForbiddenException("Not project owner");
    }
    return project;
  }

  async rename(projectId: string, ownerId: string, name: string) {
    await this.getOwned(projectId, ownerId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { name },
    });
  }

  async remove(projectId: string, ownerId: string) {
    await this.getOwned(projectId, ownerId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  }

  async getCurrentPlan(projectId: string, ownerId: string) {
    await this.getOwned(projectId, ownerId);
    const revision = await this.prisma.planRevision.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    if (!revision) {
      return { revision: null, plan: emptyPlan() };
    }
    return {
      revision,
      plan: PlanDocumentSchema.parse(JSON.parse(revision.document)),
    };
  }

  async listRevisions(projectId: string, ownerId: string) {
    await this.getOwned(projectId, ownerId);
    return this.prisma.planRevision.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        source: true,
        createdAt: true,
      },
    });
  }

  async commitPlan(
    projectId: string,
    ownerId: string,
    plan: PlanDocument,
    source: string,
  ) {
    await this.getOwned(projectId, ownerId);
    const latest = await this.prisma.planRevision.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const document = PlanDocumentSchema.parse({
      ...plan,
      meta: {
        ...plan.meta,
        version,
        updatedAt: new Date().toISOString(),
      },
    });
    const revision = await this.prisma.planRevision.create({
      data: {
        projectId,
        version,
        document: JSON.stringify(document),
        source,
      },
    });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
    return { revision, plan: document };
  }

  async patchPlan(
    projectId: string,
    ownerId: string,
    patch: Partial<PlanDocument>,
    source: string,
  ) {
    const { plan } = await this.getCurrentPlan(projectId, ownerId);
    const next = applyPlanPatch(plan, patch);
    return this.commitPlan(projectId, ownerId, next, source);
  }

  async undo(projectId: string, ownerId: string) {
    await this.getOwned(projectId, ownerId);
    const revisions = await this.prisma.planRevision.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      take: 2,
    });
    if (revisions.length < 2) {
      return this.getCurrentPlan(projectId, ownerId);
    }
    await this.prisma.planRevision.delete({ where: { id: revisions[0].id } });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
    return this.getCurrentPlan(projectId, ownerId);
  }
}
