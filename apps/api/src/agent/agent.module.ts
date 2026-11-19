import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProjectsModule } from "../projects/projects.module";
import { EventsModule } from "../events/events.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [AuthModule, ProjectsModule, EventsModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
