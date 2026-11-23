import { spawn } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function testCDP() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-dbg-'));
  const port = 9228;

  const proc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });
  proc.unref();

  await new Promise(r => setTimeout(r, 2000));

  const list = await new Promise<any>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });

  console.log('List of targets:', list);
  const pageTarget = list.find((t: any) => t.type === 'page');
  console.log('Page target:', pageTarget);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      console.log('Connected to WebSocket!');
      resolve();
    };
    ws.onerror = reject;
  });

  ws.onmessage = (ev) => {
    console.log('CDP msg:', ev.data);
  };

  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'http://localhost:3000/login' } }));

  await new Promise(r => setTimeout(r, 2500));

  ws.close();
  proc.kill();
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
  console.log('CDP test completed successfully!');
}

testCDP().catch(err => {
  console.error('CDP test error:', err);
  process.exit(1);
});
