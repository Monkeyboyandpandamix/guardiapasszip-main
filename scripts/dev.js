import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

function startProcess(command, args, label, env = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: false,
  });

  child.on('error', (err) => {
    console.error(`[dev:${label}] failed to start: ${err.message}`);
  });

  return child;
}

const server = startProcess(process.execPath, ['server/index.js'], 'server');
const viteCmd = isWin ? 'npx.cmd' : 'npx';
const client = startProcess(viteCmd, ['vite'], 'client');

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!server.killed) server.kill('SIGTERM');
  if (!client.killed) client.kill('SIGTERM');

  setTimeout(() => {
    if (!server.killed) server.kill('SIGKILL');
    if (!client.killed) client.kill('SIGKILL');
    process.exit(code);
  }, 1000);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

server.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[dev:server] exited with code ${code ?? 0}`);
    shutdown(code ?? 1);
  }
});

client.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[dev:client] exited with code ${code ?? 0}`);
    shutdown(code ?? 1);
  }
});
