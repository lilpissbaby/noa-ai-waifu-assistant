// Herramientas básicas del PC: hora, abrir URLs, portapapeles, notificaciones y (opcional) comandos.
// Las descripciones y los resultados van en inglés porque los lee el modelo; los diálogos, traducidos.
import { shell, clipboard, Notification } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { t, localeTag } from '../../shared/i18n/index.js';

export function builtinTools(cfg) {
  const tools = [
    {
      name: 'get_current_time',
      group: 'check the date and time',
      description: 'Returns the current local date, time and time zone.',
      schema: { type: 'object', properties: {} },
      run: async () => {
        const d = new Date();
        return {
          iso: d.toISOString(),
          local: d.toLocaleString(localeTag(), { dateStyle: 'full', timeStyle: 'medium' }),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      },
    },
    {
      name: 'open_url',
      group: 'open links in the browser',
      description: "Opens an http(s) URL in the user's default browser.",
      schema: { type: 'object', properties: { url: { type: 'string', description: 'Full URL including https://' } }, required: ['url'] },
      run: async ({ url }) => {
        if (!/^https?:\/\//i.test(url || '')) throw new Error('Only http(s) URLs are allowed');
        await shell.openExternal(url);
        return `Opened ${url}`;
      },
    },
    {
      name: 'clipboard_read',
      group: 'read and write the clipboard',
      description: 'Reads the text currently in the user\'s clipboard.',
      schema: { type: 'object', properties: {} },
      run: async () => clipboard.readText().slice(0, 12000) || '(clipboard is empty)',
    },
    {
      name: 'clipboard_write',
      group: 'read and write the clipboard',
      description: "Copies text to the user's clipboard.",
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      run: async ({ text }) => {
        clipboard.writeText(String(text ?? ''));
        return 'Copied to the clipboard';
      },
    },
    {
      name: 'show_notification',
      group: 'show system notifications',
      description: 'Shows a system notification (useful for alerts or short summaries).',
      schema: {
        type: 'object',
        properties: { title: { type: 'string' }, body: { type: 'string' } },
        required: ['title'],
      },
      run: async ({ title, body }) => {
        new Notification({ title: String(title), body: String(body || '') }).show();
        return 'Notification shown';
      },
    },
  ];

  if (cfg.connectors.shell?.enabled) {
    const isWin = process.platform === 'win32';
    tools.push({
      name: 'run_command',
      group: `run commands on the PC (${isWin ? 'PowerShell' : 'bash'}, always with confirmation)`,
      description: `Runs a command on the user's PC with ${isWin ? 'PowerShell' : 'bash'} and returns stdout/stderr. The user must approve it every time. Useful for ssh to the VPS, docker, git, scripts.`,
      schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run' },
          cwd: { type: 'string', description: 'Working directory (optional, defaults to the home folder)' },
          timeout_sec: { type: 'number', description: 'Time limit in seconds (default 120)' },
        },
        required: ['command'],
      },
      confirm: (input) => ({
        title: t('confirm.command.title'),
        message: t('confirm.command.message', { name: cfg.assistant.name }),
        detail: `${input.command}${input.cwd ? `\n\n${t('confirm.command.folder', { path: input.cwd })}` : ''}`,
        allowAlways: false,
      }),
      run: ({ command, cwd, timeout_sec }, { signal }) =>
        new Promise((resolve) => {
          const opts = {
            cwd: cwd || os.homedir(),
            timeout: Math.min(Number(timeout_sec) || 120, 1800) * 1000,
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true,
            encoding: 'utf8',
          };
          // En Windows se llama a PowerShell directamente (sin cmd.exe) y con salida UTF-8 para que no se rompan tildes ni comillas.
          const [file, args] = isWin
            ? [
                'powershell.exe',
                ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`],
              ]
            : ['/bin/bash', ['-lc', command]];
          const child = execFile(
            file,
            args,
            opts,
            (err, stdout, stderr) => {
              const cut = (s) => (s.length > 8000 ? `${s.slice(0, 4000)}\n…\n${s.slice(-4000)}` : s);
              resolve({
                exitCode: err ? (err.code ?? 1) : 0,
                stdout: cut(String(stdout || '')),
                stderr: cut(String(stderr || '')),
                ...(err?.killed ? { note: 'Process stopped: time limit reached' } : {}),
              });
            },
          );
          signal?.addEventListener('abort', () => child.kill());
        }),
    });
  }
  return tools;
}
