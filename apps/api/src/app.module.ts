import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { FilesModule } from "./files/files.module";
import { JobsModule } from "./jobs/jobs.module";
import { AgentModule } from "./agent/agent.module";
import { HealthController } from "./health.controller";
import { EventsModule } from "./events/events.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    FilesModule,
    JobsModule,
    AgentModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
