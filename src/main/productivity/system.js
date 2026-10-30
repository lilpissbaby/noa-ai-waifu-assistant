// Estado del equipo: CPU, memoria, discos, red, tiempo encendido y, si se pide, los procesos que
// más consumen. Solo lectura.
import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const GB = 1024 ** 3;
const round1 = (n) => Math.round(n * 10) / 10;

// Uso de CPU entre dos lecturas de os.cpus() (0–100).
export function cpuPercent(a, b) {
  let idle = 0;
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const ta = a[i].times;
    const tb = b[i].times;
    const sum = (t) => t.user + t.nice + t.sys + t.idle + t.irq;
    idle += tb.idle - ta.idle;
    total += sum(tb) - sum(ta);
  }
  return total > 0 ? round1(100 * (1 - idle / total)) : 0;
}

export function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d ? `${d}d` : '', h ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
}

function disks(platform = process.platform) {
  const roots = platform === 'win32' ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`) : ['/', os.homedir()];
  const out = [];
  const seen = new Set();
  for (const root of roots) {
    try {
      if (platform === 'win32' && !fs.existsSync(root)) continue;
      const s = fs.statfsSync(root);
      const total = s.blocks * s.bsize;
      if (!total) continue;
      const key = `${s.blocks}:${s.bfree}:${s.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const free = s.bavail * s.bsize;
      out.push({ path: root, totalGB: round1(total / GB), freeGB: round1(free / GB), usedPercent: round1(100 * (1 - free / total)) });
    } catch {
      /* unidad sin medio, sin permiso… */
    }
  }
  return out;
}

function topProcesses(limit = 8) {
  return new Promise((resolve) => {
    const done = (rows) => resolve(rows.slice(0, limit));
    if (process.platform === 'win32') {
      const ps = `Get-Process | Sort-Object -Property WorkingSet64 -Descending | Select-Object -First ${limit} | ForEach-Object { "{0}\`t{1}\`t{2}" -f $_.ProcessName, [math]::Round($_.WorkingSet64/1MB), [math]::Round($_.CPU) }`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 8000, windowsHide: true }, (err, stdout) => {
        if (err) return done([]);
        done(
          stdout
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => {
              const [name, mb, cpu] = l.split('\t');
              return { name, memoryMB: Number(mb), cpuSeconds: Number(cpu) || 0 };
            }),
        );
      });
    } else {
      execFile('ps', ['-eo', 'comm,%cpu,rss', '--sort=-%cpu', '--no-headers'], { timeout: 8000 }, (err, stdout) => {
        if (err) return done([]);
        done(
          stdout
            .split('\n')
            .filter(Boolean)
            .map((l) => {
              const m = l.trim().match(/^(.*?)\s+([\d.]+)\s+(\d+)$/);
              return m ? { name: m[1], cpuPercent: Number(m[2]), memoryMB: Math.round(Number(m[3]) / 1024) } : null;
            })
            .filter(Boolean),
        );
      });
    }
  });
}

export async function systemStatus({ processes = false, onBattery = null, sampleMs = 400 } = {}) {
  const a = os.cpus();
  await new Promise((r) => setTimeout(r, sampleMs));
  const b = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  const nets = Object.entries(os.networkInterfaces())
    .flatMap(([name, list]) => (list || []).filter((n) => !n.internal && n.family === 'IPv4').map((n) => ({ name, address: n.address })))
    .slice(0, 6);
  return {
    host: os.hostname(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    uptime: formatUptime(os.uptime()),
    cpu: { model: a[0]?.model?.trim(), cores: a.length, usagePercent: cpuPercent(a, b), ...(process.platform !== 'win32' ? { load: os.loadavg().map(round1) } : {}) },
    memory: { totalGB: round1(total / GB), usedGB: round1((total - free) / GB), usedPercent: round1(100 * (1 - free / total)) },
    disks: disks(),
    network: nets,
    ...(onBattery != null ? { power: onBattery ? 'battery' : 'plugged in' } : {}),
    ...(processes ? { topProcesses: await topProcesses() } : {}),
  };
}
