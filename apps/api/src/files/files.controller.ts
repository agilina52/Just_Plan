import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import * as fs from "node:fs";
import { AuthGuard } from "../auth/auth.guard";
import { AuthUser } from "../auth/auth.service";
import { ProjectsService } from "../projects/projects.service";
import { FilesService } from "./files.service";
import { JobsService } from "../jobs/jobs.service";

@Controller()
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly projects: ProjectsService,
    private readonly jobs: JobsService,
  ) {}

  @Post("files/projects/:projectId/upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: { user: AuthUser },
    @Param("projectId") projectId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("file is required");
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.mimetype)) {
      throw new BadRequestException("Only JPG/PNG allowed");
    }
    await this.projects.getOwned(projectId, req.user.id);
    const asset = await this.files.saveProjectImage({
      projectId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
    const job = await this.jobs.enqueueVectorize({
      projectId,
      ownerId: req.user.id,
      assetId: asset.id,
      assetKey: asset.key,
      assetUrl: asset.url,
    });
    return { asset, job };
  }

  @Get("files/raw/projects/:projectId/:filename")
  async raw(
    @Param("projectId") projectId: string,
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    const key = `projects/${projectId}/${filename}`;
    const full = this.files.resolveKeyPath(key);
    if (!fs.existsSync(full)) throw new NotFoundException("File not found");
    return res.sendFile(full);
  }
}
