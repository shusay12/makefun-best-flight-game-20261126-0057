// A tiny static server for local play-testing: serves game/ at
// http://localhost:8080. `node serve.ts`, then open that address in Chrome.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  const file = join(root, path === '/' ? 'index.html' : decodeURIComponent(path));
  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

server.listen(8080, () => console.log('Kestrel Ridge Run at http://localhost:8080'));
