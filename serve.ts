// serve.ts — static development server for the EMBERLINE game.
// Serves game/ at http://localhost:8080 so the game can be played locally.
// Node 22, standard library only.
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(REPO_ROOT, 'game');
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glsl': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = join(GAME_DIR, path);
    if (!file.startsWith(GAME_DIR)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const type = MIME[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`EMBERLINE serving game/ at http://localhost:${PORT}/`);
});
