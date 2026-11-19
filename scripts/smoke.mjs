const API = process.env.API_URL ?? "http://localhost:4000";
const ML = process.env.ML_URL ?? "http://localhost:8000";

async function main() {
  const healthApi = await fetch(`${API}/health`).then((r) => r.json());
  const healthMl = await fetch(`${ML}/health`).then((r) => r.json());
  console.log("health", { healthApi, healthMl });

  const login = await fetch(`${API}/auth/dev-login`, { method: "POST" }).then(
    (r) => r.json(),
  );
  const token = login.token;
  console.log("logged in", login.user.email);

  const project = await fetch(`${API}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Smoke Project" }),
  }).then((r) => r.json());
  console.log("project", project.id);

  const chat = await fetch(`${API}/projects/${project.id}/agent/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "add door" }),
  }).then((r) => r.json());
  console.log("agent reply", chat.message?.content?.slice(0, 120));
  console.log("walls", chat.plan?.walls?.length, "openings", chat.plan?.openings?.length);
  if (!chat.plan?.walls?.length) throw new Error("expected walls after agent edit");
  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error("SMOKE FAILED", err);
  process.exit(1);
});
