/**
 * Serves the built Admin UI locally with /api proxied to the production admin
 * backend, so the real page drives real data. Vercel has not redeployed yet, so
 * this is how the new pages reach production.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const UPSTREAM = 'https://nalandanexus-1.onrender.com';
const DIST = 'C:/Users/adars/Downloads/Nalanda/admin/frontend/dist';
const TYPES = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    const body = ['GET','HEAD'].includes(req.method) ? undefined
      : await new Promise((r) => { const c=[]; req.on('data',x=>c.push(x)); req.on('end',()=>r(Buffer.concat(c))); });
    const headers = { ...req.headers };
    delete headers.host; delete headers.origin; delete headers.referer;
    try {
      const up = await fetch(`${UPSTREAM}${req.url}`, { method: req.method, headers, body, redirect: 'manual' });
      const out = new Headers(up.headers);
      out.delete('content-encoding'); out.delete('content-length');
      const cookies = up.headers.getSetCookie ? up.headers.getSetCookie() : [];
      out.delete('set-cookie');
      const buf = Buffer.from(await up.arrayBuffer());
      const hdr = Object.fromEntries(out);
      if (cookies.length) hdr['set-cookie'] = cookies.map(c => c.replace(/;\s*Secure/gi,'').replace(/;\s*SameSite=None/gi,'; SameSite=Lax').replace(/;\s*Domain=[^;]+/gi,''));
      res.writeHead(up.status, hdr);
      return res.end(buf);
    } catch (err) {
      res.writeHead(502, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ success:false, message: err.message }));
    }
  }
  let file = url.pathname.startsWith('/qa-asset/') ? path.join(DIST,'assets',url.pathname.slice('/qa-asset/'.length)) : path.join(DIST, url.pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST,'index.html');
  let content = fs.readFileSync(file);
  if (file.endsWith('index.html')) content = Buffer.from(content.toString().replace(/\/assets\//g,'/qa-asset/'));
  res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
  res.end(content);
}).listen(5300, '127.0.0.1', () => console.log('ADMIN PROXY READY http://127.0.0.1:5300 -> ' + UPSTREAM));
