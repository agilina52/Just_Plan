import { Injectable } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FilesService {
  private readonly root = path.resolve(
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"),
  );

  constructor(private readonly prisma: PrismaService) {}

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  /** Local disk storage mimicking S3 (works without MinIO/Docker). */
  async saveProjectImage(input: {
    projectId: string;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
  }) {
    await this.ensureRoot();
    const ext = path.extname(input.originalName) || ".jpg";
    const key = `projects/${input.projectId}/${randomUUID()}${ext}`;
    const fullPath = path.join(this.root, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);

    const url = `/files/raw/${key}`;
    const asset = await this.prisma.projectAsset.create({
      data: {
        projectId: input.projectId,
        kind: "source_image",
        key,
        mimeType: input.mimeType,
        size: input.buffer.length,
        url,
      },
    });
    return asset;
  }

  resolveKeyPath(key: string) {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.root, normalized);
  }
}
