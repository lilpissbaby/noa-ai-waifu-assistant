// Herramientas básicas del PC: hora, abrir URLs, portapapeles, notificaciones y (opcional) comandos.
import { shell, clipboard, Notification } from 'electron';
import { execFile } from 'node:child_process';
import os from 'node:os';

export function builtinTools(cfg) {
  const tools = [
    {
      name: 'get_current_time',
      group: 'consultar fecha y hora',
      description: 'Devuelve la fecha y hora local actuales y la zona horaria.',
      schema: { type: 'object', properties: {} },
      run: async () => {
        const d = new Date();
        return {
          iso: d.toISOString(),
          local: d.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' }),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      },
    },
    {
      name: 'open_url',
      group: 'abrir enlaces en el navegador',
      description: 'Abre una URL http(s) en el navegador predeterminado del usuario.',
      schema: { type: 'object', properties: { url: { type: 'string', description: 'URL completa con https://' } }, required: ['url'] },
      run: async ({ url }) => {
        if (!/^https?:\/\//i.test(url || '')) throw new Error('Solo se permiten URLs http(s)');
        await shell.openExternal(url);
        return `Abierta ${url}`;
      },
    },
    {
      name: 'clipboard_read',
      group: 'leer y escribir el portapapeles',
      description: 'Lee el texto que el usuario tiene ahora mismo en el portapapeles.',
      schema: { type: 'object', properties: {} },
      run: async () => clipboard.readText().slice(0, 12000) || '(portapapeles vacío)',
    },
    {
      name: 'clipboard_write',
      group: 'leer y escribir el portapapeles',
      description: 'Copia texto al portapapeles del usuario.',
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      run: async ({ text }) => {
        clipboard.writeText(String(text ?? ''));
        return 'Copiado al portapapeles';
      },
    },
    {
      name: 'show_notification',
      group: 'mostrar notificaciones del sistema',
      description: 'Muestra una notificación del sistema (útil para avisos o resúmenes cortos).',
      schema: {
        type: 'object',
        properties: { title: { type: 'string' }, body: { type: 'string' } },
        required: ['title'],
      },
      run: async ({ title, body }) => {
        new Notification({ title: String(title), body: String(body || '') }).show();
        return 'Notificación mostrada';
      },
    },
  ];

  if (cfg.connectors.shell?.enabled) {
    const isWin = process.platform === 'win32';
    tools.push({
      name: 'run_command',
      group: `ejecutar comandos en el PC (${isWin ? 'PowerShell' : 'bash'}, siempre con confirmación)`,
      description: `Ejecuta un comando en el PC del usuario usando ${isWin ? 'PowerShell' : 'bash'} y devuelve stdout/stderr. El usuario debe aprobarlo cada vez. Útil para ssh al VPS, docker, git, scripts.`,
      schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Comando a ejecutar' },
          cwd: { type: 'string', description: 'Carpeta de trabajo (opcional, por defecto la carpeta personal)' },
          timeout_sec: { type: 'number', description: 'Límite en segundos (por defecto 120)' },
        },
        required: ['command'],
      },
      confirm: (input) => ({
        title: 'Ejecutar comando',
        message: `${cfg.assistant.name} quiere ejecutar en tu PC:`,
        detail: `${input.command}${input.cwd ? `\n\nCarpeta: ${input.cwd}` : ''}`,
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
                ...(err?.killed ? { note: 'Proceso detenido por tiempo límite' } : {}),
              });
            },
          );
          signal?.addEventListener('abort', () => child.kill());
        }),
    });
  }
  return tools;
}
