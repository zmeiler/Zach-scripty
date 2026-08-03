/**
 * Minimal static file server for the client bundle.
 *
 * Path traversal is blocked by resolving every request against the document
 * root and refusing anything that escapes it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN'
};

export function createStaticHandler({ root, index = '/client/index.html' }) {
  const documentRoot = path.resolve(root);

  return async function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS });
      res.end('Method Not Allowed');
      return true;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, SECURITY_HEADERS);
      res.end('Bad Request');
      return true;
    }

    if (pathname === '/' || pathname === '') pathname = index;
    let target = path.resolve(documentRoot, `.${pathname}`);
    if (target !== documentRoot && !target.startsWith(documentRoot + path.sep)) {
      res.writeHead(403, SECURITY_HEADERS);
      res.end('Forbidden');
      return true;
    }

    let stat;
    try {
      stat = await fs.stat(target);
      if (stat.isDirectory()) {
        target = path.join(target, 'index.html');
        stat = await fs.stat(target);
      }
    } catch {
      return false; // let the caller produce a 404
    }

    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Last-Modified': stat.mtime.toUTCString(),
      // The client is a development-friendly build: never cache HTML, and let
      // the browser revalidate everything else.
      'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache',
      ...SECURITY_HEADERS
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return true;
    }

    res.writeHead(200, headers);
    createReadStream(target).pipe(res);
    return true;
  };
}
