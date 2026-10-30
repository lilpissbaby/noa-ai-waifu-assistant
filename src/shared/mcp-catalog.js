// Catálogo de servidores MCP conocidos: se añaden con un clic en Ajustes → Automatizaciones y
// solo queda poner la clave o la carpeta. needs: lo que tiene que estar instalado en el PC
// (node → npx, uv → uvx) o «remote» si es un servidor en internet.
// {folder} se cambia por la primera carpeta autorizada en Productividad (o se deja para rellenar).
// La descripción de cada uno está en las traducciones: mcpCatalog.items.<id>.
export const MCP_CATALOG = [
  { id: 'filesystem', name: 'Filesystem', type: 'stdio', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem {folder}', env: '', needs: 'node', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem' },
  { id: 'git', name: 'Git', type: 'stdio', command: 'uvx', args: 'mcp-server-git --repository {folder}', env: '', needs: 'uv', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git' },
  { id: 'fetch', name: 'Fetch', type: 'stdio', command: 'uvx', args: 'mcp-server-fetch', env: '', needs: 'uv', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch' },
  { id: 'time', name: 'Time', type: 'stdio', command: 'uvx', args: 'mcp-server-time', env: '', needs: 'uv', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time' },
  { id: 'memory', name: 'Memory (knowledge graph)', type: 'stdio', command: 'npx', args: '-y @modelcontextprotocol/server-memory', env: '', needs: 'node', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory' },
  { id: 'thinking', name: 'Sequential Thinking', type: 'stdio', command: 'npx', args: '-y @modelcontextprotocol/server-sequential-thinking', env: '', needs: 'node', docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking' },
  { id: 'playwright', name: 'Playwright (browser)', type: 'stdio', command: 'npx', args: '-y @playwright/mcp@latest', env: '', needs: 'node', docs: 'https://github.com/microsoft/playwright-mcp' },
  { id: 'context7', name: 'Context7 (library docs)', type: 'http', url: 'https://mcp.context7.com/mcp', headersJson: '', needs: 'remote', token: 'optional', docs: 'https://github.com/upstash/context7' },
  { id: 'github', name: 'GitHub (official)', type: 'http', url: 'https://api.githubcopilot.com/mcp/', headersJson: '', needs: 'remote', token: 'required', docs: 'https://github.com/github/github-mcp-server' },
  { id: 'homeassistant', name: 'Home Assistant', type: 'http', url: '{ha}/api/mcp', headersJson: '', needs: 'remote', token: 'required', docs: 'https://www.home-assistant.io/integrations/mcp_server' },
  { id: 'notion', name: 'Notion', type: 'stdio', command: 'npx', args: '-y @notionhq/notion-mcp-server', env: 'NOTION_TOKEN=', needs: 'node', docs: 'https://github.com/makenotion/notion-mcp-server' },
  { id: 'obsidian', name: 'Obsidian', type: 'stdio', command: 'npx', args: '-y obsidian-mcp-server', env: 'OBSIDIAN_API_KEY=\nOBSIDIAN_BASE_URL=http://127.0.0.1:27123', needs: 'node', docs: 'https://github.com/cyanheads/obsidian-mcp-server' },
  { id: 'brave', name: 'Brave Search', type: 'stdio', command: 'npx', args: '-y @brave/brave-search-mcp-server', env: 'BRAVE_API_KEY=', needs: 'node', docs: 'https://github.com/brave/brave-search-mcp-server' },
  { id: 'firecrawl', name: 'Firecrawl (web scraping)', type: 'stdio', command: 'npx', args: '-y firecrawl-mcp', env: 'FIRECRAWL_API_KEY=', needs: 'node', docs: 'https://github.com/firecrawl/firecrawl-mcp-server' },
  { id: 'paperclip', name: 'Paperclip (MCP)', type: 'stdio', command: 'uvx', args: 'paperclip-mcp --transport stdio', env: 'PAPERCLIP_BASE_URL=http://localhost:3100\nPAPERCLIP_API_KEY=', needs: 'uv', docs: 'https://github.com/elevateinformatics/paperclip-mcp' },
];

// Entrada del catálogo → servidor listo para guardar en connectors.mcpServers (desactivado hasta
// que el usuario lo revise).
export function serverFromCatalog(item, { id, folder = '', haUrl = '' } = {}) {
  const fill = (s) =>
    String(s || '')
      .replaceAll('{folder}', folder ? (/\s/.test(folder) ? `"${folder}"` : folder) : '')
      .replaceAll('{ha}', String(haUrl || 'http://homeassistant.local:8123').replace(/\/+$/, ''))
      .trim();
  const base = { id, name: item.name, type: item.type, enabled: false, catalog: item.id };
  return item.type === 'http' ? { ...base, url: fill(item.url), headersJson: item.headersJson || '' } : { ...base, command: item.command, args: fill(item.args), env: item.env || '' };
}
