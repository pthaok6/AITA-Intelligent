const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this launcher with npm start or npm run dev.');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const children = [];
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        if (error.code !== 'ESRCH') console.error(error.message);
      }
    }
  }
  process.exit(exitCode);
}

function launch(app) {
  const child = spawn(process.execPath, [npmCli, '--prefix', `apps/${app === 'worker' ? 'backend' : app}`, 'run', app === 'worker' ? 'dev:worker' : 'dev'], {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Cannot start ${app}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${app} stopped (${signal || code}).`);
      stop(code || (signal ? 1 : 0));
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

function checkListener(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`Port ${port} is already in use. Stop the existing app with Ctrl+C, then run npm start again.`));
    });
    socket.once('error', error => {
      if (['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'EAFNOSUPPORT'].includes(error.code)) resolve();
      else reject(new Error(`Cannot check port ${port} on ${host}: ${error.message}`));
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error(`Timed out checking port ${port} on ${host}.`));
    });
  });
}

async function checkPort(port) {
  // Vite may listen only on ::1; a wildcard bind alone can miss it on Windows.
  await Promise.all([checkListener(port, '127.0.0.1'), checkListener(port, '::1')]);
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      reject(new Error(error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the existing app with Ctrl+C, then run npm start again.`
        : `Cannot use port ${port}: ${error.message}`));
    });
    server.listen({ port, exclusive: true }, () => server.close(resolve));
  });
}

async function main() {
  const envPath = path.join(root, 'apps/backend/.env');
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const envPort = envText.match(/^\s*PORT\s*=\s*["']?(\d+)/m)?.[1];
  const backendPort = Number(process.env.PORT || envPort || 5000);
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
    throw new Error('Backend PORT must be an integer between 1 and 65535.');
  }
  if (backendPort === 5173) throw new Error('Backend PORT cannot use frontend port 5173.');
  await Promise.all([checkPort(backendPort), checkPort(5173)]);
  launch('backend');
  launch('worker');
  launch('frontend');
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
