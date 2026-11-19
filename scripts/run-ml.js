const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const mlRoot = path.resolve(__dirname, "../apps/ml");
const isWin = process.platform === "win32";
const venvPython = path.join(
  mlRoot,
  ".venv",
  isWin ? "Scripts/python.exe" : "bin/python",
);
const python = fs.existsSync(venvPython) ? venvPython : "python";
const reload = !process.argv.includes("--no-reload");
const args = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
];
if (reload) args.push("--reload");

const child = spawn(python, args, {
  cwd: mlRoot,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
