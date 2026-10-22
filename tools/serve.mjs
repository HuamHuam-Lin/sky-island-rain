import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8','.json':'application/json'};
const port = +(process.env.PORT || 4173);
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if (file !== path.resolve(root) && !file.startsWith(root)) {res.writeHead(403).end(); return;}
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(body);
  } catch {res.writeHead(404).end('找不到檔案');}
}).listen(port,'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${port}`));
