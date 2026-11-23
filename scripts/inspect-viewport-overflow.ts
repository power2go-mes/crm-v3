import { spawn, type ChildProcess } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createBrowserClient } from '@supabase/ssr';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const credsPath = path.resolve(__dirname, '../.test-credentials.local.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
const supabaseUrl = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
const publishableKey = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

class CDPClient {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();

  async connect(wsUrl: string) {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Eval error: ${desc}`);
    }
    return res.result?.value as T;
  }

  async navigate(url: string, waitMs = 2000) {
    await this.send('Page.navigate', { url });
    await this.wait(waitMs);
  }

  async wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  close() {
    this.ws.close();
  }
}

async function getAuthCookies(email: string) {
  const cookieJar = new Map<string, string>();
  const client = createBrowserClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: creds[email] });
  if (error || !data.session) throw new Error(`Auth failed: ${error?.message}`);
  return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));
}

async function inspectOverflow() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-overflow-'));
  const port = 9230;
  const browserProc: ChildProcess = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const targets = await new Promise<any>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t: any) => t.type === 'page');
  const cdp = new CDPClient();
  await cdp.connect(pageTarget.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  try {
    const cookies = await getAuthCookies('test.superadmin@finlonexa.test');
    for (const c of cookies) await cdp.send('Network.setCookie', c);

    const routes = ['/dashboard', '/leads', '/opportunities', '/accounts', '/contacts'];
    const viewports = [
      { name: 'Desktop', width: 1440, height: 900, mobile: false },
      { name: 'Laptop', width: 1366, height: 768, mobile: false },
      { name: 'Mobile', width: 390, height: 844, mobile: true },
    ];

    for (const vp of viewports) {
      console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.mobile ? 3 : 1,
        mobile: vp.mobile,
      });

      for (const r of routes) {
        await cdp.navigate(`http://localhost:3000${r}`, 2000);
        const metrics = await cdp.evaluate<{
          scrollWidth: number;
          innerWidth: number;
          hasOverflow: boolean;
          overflowElements: string[];
        }>(`
          (() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const hasOverflow = docWidth > winWidth;
            const overflowElements = [];
            if (hasOverflow) {
              const all = document.querySelectorAll('*');
              for (const el of all) {
                const rect = el.getBoundingClientRect();
                if (rect.right > winWidth + 1) {
                  overflowElements.push(el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : '') + ' (right: ' + Math.round(rect.right) + 'px)');
                }
              }
            }
            return {
              scrollWidth: docWidth,
              innerWidth: winWidth,
              hasOverflow,
              overflowElements: overflowElements.slice(0, 5),
            };
          })()
        `);

        console.log(`Route ${r}: scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth}, hasOverflow=${metrics.hasOverflow}`);
        if (metrics.hasOverflow) {
          console.log('   Culprits:', metrics.overflowElements);
        }
      }
    }
  } finally {
    cdp.close();
    browserProc.kill();
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
  }
}

inspectOverflow().catch(console.error);
