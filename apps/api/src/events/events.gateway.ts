import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  },
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("join_project")
  handleJoin(@MessageBody() data: { projectId: string }) {
    return { event: "joined", data };
  }

  emitJob(projectId: string, job: unknown) {
    this.server?.emit(`job:${projectId}`, job);
  }

  emitPlan(projectId: string, payload: unknown) {
    this.server?.emit(`plan:${projectId}`, payload);
  }

  emitAgent(projectId: string, payload: unknown) {
    this.server?.emit(`agent:${projectId}`, payload);
  }
}
