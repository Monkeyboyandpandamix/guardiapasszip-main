import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

function startProcess(command, label, env = {}) {
  const child = spawn(command, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
    windowsHide: false,
  });

  child.on('error', (err) => {
    console.error(`[dev:${label}] failed to start: ${err.message}`);
  });

  return child;
}

const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const server = startProcess(`${npmCmd} run server`, 'server');
const client = startProcess(`${npxCmd} vite`, 'client');

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
