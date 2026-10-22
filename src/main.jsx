import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Highlight, themes } from 'prism-react-renderer';
import { ExternalLink, Play, RotateCcw, Square, RefreshCw, Package, Terminal, Copy } from 'lucide-react';
import './index.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const api = async (url, opts) => {
  const r = await fetch(url.replace(/^\//, ''), {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body && JSON.stringify(opts.body),
  });
  const ct = r.headers.get('content-type') || '';
  return { ok: r.ok, data: ct.includes('json') ? await r.json() : await r.text() };
};

const STATUS = {
  stopped: { label: 'Stopped', className: 'bg-muted text-muted-foreground' },
  installing: { label: 'Installing…', className: 'bg-amber-100 text-amber-800' },
  running: { label: 'Running', className: 'bg-emerald-100 text-emerald-800' },
  stopping: { label: 'Stopping…', className: 'bg-amber-100 text-amber-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
};

const langOf = (f) =>
  /\.(jsx?|mjs|cjs)$/.test(f) ? 'jsx' : f.endsWith('.json') ? 'json' : f.endsWith('.html') ? 'markup' : f.endsWith('.css') ? 'css' : 'plain';

function CodeView({ code, file }) {
  return (
    <Highlight theme={themes.vsDark} code={code} language={langOf(file)}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre className="m-0 min-h-full p-4 text-[13px] leading-6" style={{ ...style, background: 'transparent' }}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })} className="table-row">
              <span className="table-cell select-none pr-4 text-right text-white/30">{i + 1}</span>
              <span className="table-cell">{line.map((t, k) => <span key={k} {...getTokenProps({ token: t })} />)}</span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

function App() {
  const [templates, setTemplates] = useState([]);
  const [id, setId] = useState(null);
  const [ws, setWs] = useState(null);
  const [values, setValues] = useState({});
  const [file, setFile] = useState(null);
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [pkg, setPkg] = useState('');
  const [pkgOut, setPkgOut] = useState('');
  const [tab, setTab] = useState('preview');
  const [frameKey, setFrameKey] = useState(0);
  const logRef = useRef();

  const t = templates.find((x) => x.id === id);

  useEffect(() => {
    api('/api/templates').then(({ data }) => { setTemplates(data); setId(data[0]?.id); });
  }, []);

  const refresh = useCallback(async () => {
    if (!id) return;
    const { data } = await api(`/api/workspaces/${id}`);
    setWs(data);
    return data;
  }, [id]);

  const loadFile = useCallback(async (p, wsId = id) => {
    const { data } = await api(`/api/workspaces/${wsId}/file?path=${encodeURIComponent(p)}`);
    setFile(p); setCode(data); setDraft(data); setEditing(false);
  }, [id]);

  useEffect(() => {
    setWs(null); setFile(null); setCode(''); setValues({}); setEditing(false);
    refresh().then((d) => {
      if (!d) return;
      setValues(d.values);
      if (d.files.length) loadFile(d.files.includes('server.js') ? 'server.js' : d.files.find((f) => f.endsWith('main.jsx')) ?? d.files[0], id);
      setTab(d.status === 'running' ? 'preview' : 'code');
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [ws?.log?.length]);

  // switch to the preview as soon as the app is up
  const prevStatus = useRef();
  useEffect(() => {
    if (ws?.status === 'running' && prevStatus.current !== 'running') setTab('preview');
    prevStatus.current = ws?.status;
  }, [ws?.status]);

  const start = async () => {
    await api(`/api/workspaces/${id}/start`, { method: 'POST', body: { values } });
    const d = await refresh();
    setValues(d.values);
  };
  const stop = () => api(`/api/workspaces/${id}/stop`, { method: 'POST' }).then(refresh);
  const reset = async () => {
    if (!confirm('Delete this workspace and your edits?')) return;
    await api(`/api/workspaces/${id}/reset`, { method: 'POST' });
    const d = await refresh();
    setValues(d.values);
    file && loadFile(file);
  };
  const saveFile = async () => {
    await api(`/api/workspaces/${id}/file?path=${encodeURIComponent(file)}`, { method: 'PUT', body: { content: draft } });
    setCode(draft); setEditing(false);
    setTimeout(() => setFrameKey((k) => k + 1), 600);
    refresh();
  };
  const install = async () => {
    setPkgOut('Installing…');
    const { data } = await api(`/api/workspaces/${id}/install`, {
      method: 'POST', body: { packages: pkg.split(/\s+/).filter(Boolean) },
    });
    setPkgOut(data.output || data.error); setPkg('');
    refresh();
  };

  if (!t) return <p className="p-6 text-sm text-muted-foreground">Loading templates…</p>;
  const status = ws?.status ?? 'stopped';
  const busy = ['installing', 'running', 'stopping'].includes(status);
  const fresh = !ws?.exists;
  const missing = t.env.some((f) => !values[f.key]);
  const s = STATUS[status] ?? STATUS.stopped;

  return (
    <div className="grid h-screen grid-cols-[380px_1fr]">
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r bg-muted/30 p-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Okta SDK test runner</h1>
          <p className="text-sm text-muted-foreground">Pick a template, add your test app's settings, run it.</p>
        </div>

        <Select value={id} onValueChange={setId} disabled={busy}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Okta settings</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.env.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type={f.secret ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  disabled={busy}
                  autoComplete="off"
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="rounded-md border bg-background p-2.5 text-xs">
              <div className="mb-1 text-muted-foreground">Add as a Sign-in redirect URI in Okta:</div>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all">{t.redirectUri}</code>
                <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => navigator.clipboard.writeText(t.redirectUri)}>
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          {busy
            ? <Button onClick={stop} variant="outline" className="flex-1"><Square /> Stop</Button>
            : <Button onClick={start} disabled={missing} className="flex-1"><Play /> {fresh ? 'Create & run' : 'Run'}</Button>}
          <Button onClick={reset} variant="outline" size="icon" disabled={busy || fresh} title="Reset workspace"><RotateCcw /></Button>
          <Badge className={cn('border-0', s.className)}>{s.label}</Badge>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Package className="size-3.5" /> Install a package</Label>
          <div className="flex gap-2">
            <Input value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="e.g. jwt-decode" disabled={fresh}
              onKeyDown={(e) => e.key === 'Enter' && pkg.trim() && install()} />
            <Button variant="secondary" onClick={install} disabled={fresh || !pkg.trim()}>Add</Button>
          </div>
          {fresh && <p className="text-xs text-muted-foreground">Available after the workspace is created.</p>}
          {pkgOut && <pre className="max-h-28 overflow-auto rounded-md bg-neutral-950 p-2 text-[11px] text-neutral-300">{pkgOut}</pre>}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="logs"><Terminal className="size-3.5" /> Logs</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground">{ws?.url}</code>
              <Button variant="outline" size="sm" onClick={() => setFrameKey((k) => k + 1)} disabled={status !== 'running'}><RefreshCw /> Reload</Button>
              <Button size="sm" onClick={() => window.open(ws.url, 'okta-preview', 'popup,width=1100,height=800')} disabled={status !== 'running'}>
                <ExternalLink /> Open in new window
              </Button>
            </div>
          </div>

          <TabsContent value="preview" className="m-0 min-h-0 flex-1">
            {status === 'running'
              ? <iframe key={frameKey} src={ws.url} title="preview" className="h-full w-full border-0 bg-white" />
              : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {status === 'installing' ? 'Installing dependencies… see the Logs tab.' : 'Enter your Okta settings and press Run to see the app here.'}
                </div>}
          </TabsContent>

          <TabsContent value="code" className="m-0 grid min-h-0 flex-1 grid-cols-[200px_1fr]">
            <ScrollArea className="border-r">
              <div className="p-2">
                {ws?.files.map((p) => (
                  <button key={p} onClick={() => loadFile(p)}
                    className={cn('block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent', p === file && 'bg-accent font-medium')}>
                    {p}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="flex min-h-0 min-w-0 flex-col bg-[#1e1e1e]">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-xs text-white/70">
                <span>{file}</span>
                {fresh
                  ? <span>Read-only until the workspace is created</span>
                  : editing
                    ? <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={saveFile} disabled={draft === code}>Save</Button>
                        <Button size="sm" variant="ghost" className="text-white/70" onClick={() => { setDraft(code); setEditing(false); }}>Cancel</Button>
                      </span>
                    : <Button size="sm" variant="ghost" className="text-white/70" onClick={() => setEditing(true)}>Edit</Button>}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                {editing
                  ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false}
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveFile(); } }}
                      className="block min-h-[60vh] w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-white outline-none" />
                  : <CodeView code={code} file={file ?? ''} />}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="m-0 min-h-0 flex-1">
            <pre ref={logRef} className="h-full overflow-auto bg-neutral-950 p-4 text-xs text-neutral-300">
              {ws?.log.length ? ws.log.join('\n') : 'No output yet.'}
            </pre>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
