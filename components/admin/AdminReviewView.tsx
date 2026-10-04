'use client';

import React, { useCallback, useState } from 'react';
import { DEMO_DATA } from '@/lib/demo';
import {
  Shield,
  RefreshCw,
  FileText,
  ExternalLink,
  ChevronDown,
  Flag,
  X,
  LogOut,
  Bell,
  Check,
  Sparkles,
  Link2,
  MapPin,
  Save,
  ClipboardPaste,
} from 'lucide-react';
import { AelineButton } from '@/components/AelineButton';
import { broadcastLiveUpdate } from '@/components/live/LiveDataProvider';
import type { QueueItem } from '@/lib/data/repo';
import type { DbProjectStatus } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Types (serialised from the server)
// ---------------------------------------------------------------------------

interface Stats {
  pending: number;
  flagged: number;
  approved7d: number;
  rejected7d: number;
  watchers: number;
  lastRun: null | { startedAt: string; finishedAt: string | null; mode: string; trigger: string; stats: Record<string, number>; errors: string[] };
}

interface SourceRow {
  id: string;
  name: string;
  reraId: string;
  permitNo: string | null;
  sourceUrls: { rera?: string; bpass?: string };
  siteLat: number | null;
  siteLng: number | null;
  surveyNumbers: string | null;
}

interface NotificationRow {
  id: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  status: 'sent' | 'logged' | 'failed';
  error: string | null;
  createdAt: string;
}

type Tab = 'queue' | 'history' | 'sources';

const SOURCE_LABEL: Record<string, string> = {
  TG_RERA: 'TG-RERA',
  TS_BPASS: 'TS-bPASS',
  HYDRAA_FTL: 'HYDRAA FTL',
  IGR: 'IGR rates',
  MANUAL: 'Manual / demo',
};

const DOC_LABEL: Record<string, string> = {
  RERA_QUARTERLY_DISCLOSURE: 'Quarterly disclosure',
  RERA_REGISTRATION: 'Registration',
  SANCTION_ORDER: 'Sanction order',
  OCCUPANCY_CERTIFICATE: 'Occupancy certificate',
  PENALTY_NOTICE: 'Penalty notice',
  FTL_BUFFER_CHECK: 'Lake buffer check',
  GUIDELINE_RATE: 'Guideline rate',
};

const STATUS_LABEL: Record<DbProjectStatus, string> = { verified: 'Verified', caution: 'Caution', risk: 'Risk' };

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'Not set';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return String(v);
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function Pill({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'dark' | 'lime' }) {
  const cls =
    tone === 'dark'
      ? 'bg-[#212121] text-white'
      : tone === 'lime'
      ? 'bg-[#212121] text-[#212121]'
      : 'bg-[#f9f9f9] text-[#212121] border border-[#eeeeee]';
  return <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${cls}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Review card
// ---------------------------------------------------------------------------

function ReviewCard({ item, onDone }: { item: QueueItem; onDone: (id: string, msg: string, projectUrl?: string) => void }) {
  const u = item.update;
  const [whatChanged, setWhatChanged] = useState(u.aiSummaryWhatChanged);
  const [whatItMeans, setWhatItMeans] = useState(u.aiSummaryWhatItMeans);
  const [status, setStatus] = useState<DbProjectStatus | undefined>(item.suggested?.status);
  const [score, setScore] = useState<number | undefined>(item.suggested?.score);
  const [summary, setSummary] = useState(item.live?.summary ?? '');
  const [editSummary, setEditSummary] = useState(false);
  const [notify, setNotify] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [note, setNote] = useState('');
  const [noteMode, setNoteMode] = useState<null | 'reject' | 'flag'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMarket = u.targetType === 'market';
  const confidencePct = Math.round(u.confidenceScore * 100);
  const excerpt = typeof u.rawPayload?.excerpt === 'string' ? (u.rawPayload.excerpt as string) : JSON.stringify(u.rawPayload, null, 2);

  const approve = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/approve-update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: u.id,
        whatChanged: whatChanged.trim(),
        whatItMeans: whatItMeans.trim(),
        ...(isMarket ? {} : { status, score, notify }),
        ...(editSummary && summary.trim() !== item.live?.summary ? { summary: summary.trim() } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      projectUrl?: string;
      delivery?: { subscribers: number; sent: number; logged: number; failed: number } | null;
    };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? 'Could not push this update.');
      return;
    }
    broadcastLiveUpdate();
    const d = body.delivery;
    const deliveryText = d
      ? d.subscribers === 0
        ? 'No watchers to notify.'
        : `${d.subscribers} watcher${d.subscribers === 1 ? '' : 's'}: ${d.sent} sent, ${d.logged} logged${d.failed ? `, ${d.failed} failed` : ''}.`
      : isMarket
      ? 'Benchmark updated.'
      : 'Watchers not notified.';
    onDone(u.id, `${item.live?.name ?? item.market?.name} is live. ${deliveryText}`, body.projectUrl);
  };

  const dismiss = async (action: 'reject' | 'flag') => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/reject-update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: u.id, action, note: note.trim() || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? 'Action failed.');
      return;
    }
    onDone(u.id, action === 'reject' ? 'Dismissed as a false positive.' : 'Flagged for paralegal and survey review.');
  };

  return (
    <article className="bg-white rounded-2xl border border-[#eeeeee] overflow-hidden">
      {/* Header */}
      <header className="px-5 sm:px-6 pt-5 pb-4 space-y-3 border-b border-[#eeeeee]">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="dark">{SOURCE_LABEL[u.source] ?? u.source}</Pill>
          <Pill>{DOC_LABEL[u.documentType] ?? u.documentType}</Pill>
          {u.status === 'flagged' && (
            <Pill tone="lime">
              <Flag className="w-3 h-3" strokeWidth={2.5} /> Flagged
            </Pill>
          )}
          <Pill>
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            {u.analyzer === 'claude' || u.analyzer === 'gemini' ? 'AI read' : u.analyzer === 'structured' ? 'Structured data' : 'Rules read'}
          </Pill>
          {item.watchers > 0 && (
            <Pill>
              <Bell className="w-3 h-3" strokeWidth={2} /> {item.watchers} watching
            </Pill>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">{fmtTime(u.createdAt)}</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium text-xl tracking-tight text-[#212121]">
              {item.live?.name ?? item.market?.name ?? 'Unknown target'}
              {item.live && <span className="font-sans font-medium text-sm text-[#6b6b6b]"> · {item.live.location}</span>}
            </h3>
            <p className="text-xs text-[#6b6b6b] mt-0.5 flex items-center gap-1.5 break-all">
              <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {u.rawTitle}
              {u.sourceUrl && (
                <a href={u.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[#212121] underline decoration-[#212121] decoration-2 underline-offset-2">
                  source <ExternalLink className="w-3 h-3" strokeWidth={2} />
                </a>
              )}
            </p>
          </div>
          <div className="w-40 shrink-0">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">
              <span>AI confidence</span>
              <span className="font-bold text-[#212121]">{confidencePct}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#f9f9f9] overflow-hidden">
              <div className={`h-full rounded-full ${confidencePct >= 75 ? 'bg-[#212121]' : 'bg-[#212121]'}`} style={{ width: `${confidencePct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-[#E2E2E2]">
        {/* Side-by-side comparison */}
        <section className="p-5 sm:p-6 space-y-3" aria-label="Current live data versus newly scraped data">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 font-mono text-[10px] uppercase tracking-wider font-bold text-[#6b6b6b]">
            <span>Field</span>
            <span>Current live</span>
            <span>Newly scraped</span>
          </div>
          <div className="space-y-1">
            {item.diff
              .filter((d) => d.changed || d.current !== null)
              .map((d) => (
                <div
                  key={d.key}
                  className={`grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs rounded-lg px-2 py-1.5 ${
                    d.changed ? 'bg-[#212121]/35 border-l-4 border-[#212121] font-semibold' : 'text-[#6b6b6b]'
                  }`}
                >
                  <span className="text-[#212121]">{d.label}</span>
                  <span className={d.changed ? 'line-through decoration-[#212121]/40 text-[#6b6b6b]' : ''}>{fmtValue(d.current)}</span>
                  <span className="text-[#212121] break-words">{fmtValue(d.proposed)}</span>
                </div>
              ))}
            {item.diff.every((d) => !d.changed) && (
              <p className="text-xs text-[#6b6b6b] italic px-2 pt-1">No tracked field changes. Publishing adds a timeline entry only.</p>
            )}
          </div>

          {item.live && (
            <div className="pt-3 border-t border-[#eeeeee] flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">Live verdict</span>
              <Pill>
                {STATUS_LABEL[item.live.status]} · {item.live.safetyScore}
              </Pill>
              {item.suggested && (
                <>
                  <span className="text-[#6b6b6b]">→ suggested</span>
                  <Pill tone="dark">
                    {STATUS_LABEL[item.suggested.status]} · {item.suggested.score}
                  </Pill>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121] inline-flex items-center gap-1 pt-1 cursor-pointer"
          >
            {showRaw ? 'Hide' : 'Show'} source excerpt
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRaw ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {showRaw && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#212121] text-[#E2E2E2] p-3 font-mono text-[11px] leading-relaxed">{excerpt}</pre>
          )}
        </section>

        {/* Editable summary + decision */}
        <section className="p-5 sm:p-6 space-y-4 bg-[#FAFAFA]" aria-label="Edit and decide">
          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">What changed</span>
            <textarea
              value={whatChanged}
              onChange={(e) => setWhatChanged(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[#eeeeee] bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#212121] focus:border-[#212121]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">What it means for a buyer</span>
            <textarea
              value={whatItMeans}
              onChange={(e) => setWhatItMeans(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#eeeeee] bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#212121] focus:border-[#212121]"
            />
          </label>

          {!isMarket && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <span className="block font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">Published verdict</span>
                <div role="radiogroup" className="inline-flex p-1 rounded-full bg-white border border-[#eeeeee] gap-1">
                  {(['verified', 'caution', 'risk'] as DbProjectStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={status === s}
                      onClick={() => setStatus(s)}
                      className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer ${
                        status === s ? 'bg-[#212121] text-white ring-2 ring-[#212121] ring-offset-1' : 'text-[#6b6b6b] hover:text-[#212121]'
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1.5">
                <span className="block font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">Safety score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score ?? ''}
                  onChange={(e) => setScore(e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-20 rounded-full border border-[#eeeeee] bg-white px-3 py-1.5 font-mono text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#212121]"
                />
              </label>
            </div>
          )}

          {!isMarket && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setEditSummary(!editSummary)}
                className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121] inline-flex items-center gap-1 cursor-pointer"
              >
                {editSummary ? 'Keep current public summary' : 'Edit public summary'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${editSummary ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
              {editSummary && (
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#eeeeee] bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#212121] focus:border-[#212121]"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-[#212121] cursor-pointer select-none">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="w-4 h-4 accent-[#212121]" />
                Send WhatsApp / email alert to {item.watchers} watcher{item.watchers === 1 ? '' : 's'}
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          {noteMode ? (
            <div className="space-y-2 rounded-xl border border-[#eeeeee] bg-white p-3">
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">
                  {noteMode === 'flag' ? 'What should the paralegal check?' : 'Why is this a false positive?'}
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-[#eeeeee] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#212121]"
                  placeholder={noteMode === 'flag' ? 'e.g. Verify survey no. 239 on site with the FTL map' : 'e.g. Notice refers to a different project'}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => dismiss(noteMode)}
                  className="px-4 py-2 rounded-full bg-[#212121] text-white font-mono text-[11px] uppercase tracking-wider font-bold cursor-pointer disabled:opacity-50"
                >
                  {noteMode === 'flag' ? 'Flag for paralegal' : 'Reject update'}
                </button>
                <button type="button" onClick={() => setNoteMode(null)} className="px-3 py-2 rounded-full font-mono text-[11px] uppercase tracking-wider text-[#6b6b6b] cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AelineButton variant="lime" onClick={approve} disabled={busy || whatChanged.trim().length < 5 || whatItMeans.trim().length < 5}>
                <span className="font-bold">{busy ? 'Pushing live' : 'Approve & push live'}</span>
              </AelineButton>
              {u.status !== 'flagged' && (
                <button
                  type="button"
                  onClick={() => setNoteMode('flag')}
                  className="px-4 py-2 rounded-full border border-[#212121] text-[#212121] font-mono text-[11px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5 hover:bg-white cursor-pointer min-h-[40px]"
                >
                  <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                  Flag for paralegal
                </button>
              )}
              <button
                type="button"
                onClick={() => setNoteMode('reject')}
                className="px-3 py-2 rounded-full font-mono text-[11px] uppercase tracking-wider font-bold text-[#6b6b6b] hover:text-[#212121] inline-flex items-center gap-1 cursor-pointer min-h-[40px]"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
                Reject
              </button>
            </div>
          )}
          {u.reviewerNote && (
            <p className="text-xs text-[#6b6b6b]">
              <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#212121]">Reviewer note:</span> {u.reviewerNote}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Paste-a-notice panel
// ---------------------------------------------------------------------------

function NoticeIntake({ projects, onQueued }: { projects: SourceRow[]; onQueued: () => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/ai/analyze-notice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, title: title || undefined, text: text || undefined, url: url || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean; whatChanged?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? 'Could not read the notice.');
      return;
    }
    setMsg(body.duplicate ? 'Already in the queue.' : `Queued: ${body.whatChanged}`);
    setText('');
    setUrl('');
    setTitle('');
    onQueued();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eeeeee] p-5 sm:p-6 space-y-3">
      <h3 className="font-medium text-lg text-[#212121] flex items-center gap-2">
        <ClipboardPaste className="w-4 h-4" strokeWidth={2} /> Read a notice with AI
      </h3>
      <p className="text-xs text-[#6b6b6b]">Paste an order or give a PDF link. The summary lands in the queue for review, never straight to live.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-xl border border-[#eeeeee] bg-[#f9f9f9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#212121]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.reraId})
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="rounded-xl border border-[#eeeeee] bg-[#f9f9f9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#212121]"
        />
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://rera.telangana.gov.in/... .pdf (optional)"
        className="w-full rounded-xl border border-[#eeeeee] bg-[#f9f9f9] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#212121]"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Paste notice text"
        className="w-full rounded-xl border border-[#eeeeee] bg-[#f9f9f9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#212121]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <AelineButton variant="dark" onClick={submit} disabled={busy || !projectId || (!text.trim() && !url.trim())}>
          {busy ? 'Reading' : 'Analyse & queue'}
        </AelineButton>
        {msg && <span className="text-xs text-[#212121]">{msg}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources configuration
// ---------------------------------------------------------------------------

function SourcesPanel({ rows }: { rows: SourceRow[] }) {
  const [state, setState] = useState(rows);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const update = (id: string, patch: Partial<SourceRow>) => setState((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: SourceRow) => {
    setErr(null);
    const res = await fetch('/api/admin/project-sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: r.id,
        rera: r.sourceUrls.rera ?? '',
        bpass: r.sourceUrls.bpass ?? '',
        siteLat: r.siteLat,
        siteLng: r.siteLng,
        surveyNumbers: r.surveyNumbers,
      }),
    });
    if (res.ok) {
      setSaved(r.id);
      setTimeout(() => setSaved(null), 2000);
    } else {
      setErr(`${r.name}: check the URLs and coordinates.`);
    }
  };

  const input = 'w-full rounded-lg border border-[#eeeeee] bg-[#f9f9f9] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#212121]';

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6b6b6b] max-w-3xl">
        The live worker watches these pages for changes and reads any new PDF orders linked from them. Paste each project&apos;s public TG-RERA and
        TS-bPASS page. Site coordinates drive the lake FTL buffer check.
      </p>
      {err && <p className="text-xs font-semibold text-rose-700">{err}</p>}
      {state.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-medium text-base text-[#212121]">
              {r.name} <span className="font-mono text-[11px] font-normal text-[#6b6b6b]">{r.reraId}</span>
            </h4>
            <button
              type="button"
              onClick={() => save(r)}
              className="px-3.5 py-1.5 rounded-full bg-[#212121] text-white font-mono text-[10px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {saved === r.id ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />}
              {saved === r.id ? 'Saved' : 'Save'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b] inline-flex items-center gap-1">
                <Link2 className="w-3 h-3" /> TG-RERA page
              </span>
              <input className={input} value={r.sourceUrls.rera ?? ''} onChange={(e) => update(r.id, { sourceUrls: { ...r.sourceUrls, rera: e.target.value } })} placeholder="https://rera.telangana.gov.in/..." />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b] inline-flex items-center gap-1">
                <Link2 className="w-3 h-3" /> TS-bPASS page
              </span>
              <input className={input} value={r.sourceUrls.bpass ?? ''} onChange={(e) => update(r.id, { sourceUrls: { ...r.sourceUrls, bpass: e.target.value } })} placeholder="https://tsbpass.telangana.gov.in/..." />
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b] inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Latitude
              </span>
              <input className={input} type="number" step="any" value={r.siteLat ?? ''} onChange={(e) => update(r.id, { siteLat: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">Longitude</span>
              <input className={input} type="number" step="any" value={r.siteLng ?? ''} onChange={(e) => update(r.id, { siteLng: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">Survey numbers</span>
              <input className={input} value={r.surveyNumbers ?? ''} onChange={(e) => update(r.id, { surveyNumbers: e.target.value })} />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminReviewView({
  user,
  initialItems,
  initialStats,
  initialSources,
  initialNotifications,
  claudeEnabled,
}: {
  user: string;
  initialItems: QueueItem[];
  initialStats: Stats;
  initialSources: SourceRow[];
  initialNotifications: NotificationRow[];
  claudeEnabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>('queue');
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [history, setHistory] = useState<QueueItem[] | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [notificationsLog, setNotificationsLog] = useState<NotificationRow[]>(initialNotifications);
  const [toast, setToast] = useState<{ msg: string; url?: string } | null>(null);
  const [mode, setMode] = useState<'simulate' | 'live'>(DEMO_DATA ? 'simulate' : 'live');
  const [syncing, setSyncing] = useState(false);
  const [showIntake, setShowIntake] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/queue?status=pending,flagged', { cache: 'no-store' });
    if (res.status === 401) {
      window.location.href = '/admin/login';
      return;
    }
    if (!res.ok) return;
    const body = (await res.json()) as { items: QueueItem[]; stats: Stats; notifications: NotificationRow[] };
    setItems(body.items);
    setStats(body.stats);
    setNotificationsLog(body.notifications);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/admin/queue?status=approved,rejected', { cache: 'no-store' });
    if (res.ok) setHistory(((await res.json()) as { items: QueueItem[] }).items);
  }, []);

  const runSync = async () => {
    setSyncing(true);
    const res = await fetch('/api/admin/scrape-trigger', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const body = (await res.json().catch(() => ({}))) as { queued?: number; findings?: number; errors?: string[]; error?: string };
    setSyncing(false);
    setToast({
      msg: res.ok
        ? `Sync done: ${body.findings ?? 0} finding(s), ${body.queued ?? 0} queued${body.errors?.length ? `, ${body.errors.length} error(s)` : ''}.`
        : body.error ?? 'Sync failed.',
    });
    await reload();
  };

  const handleDone = (id: string, msg: string, url?: string) => {
    setItems((prev) => prev.filter((i) => i.update.id !== id));
    setToast({ msg, url });
    setHistory(null);
    reload();
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const pending = items.filter((i) => i.update.status === 'pending');
  const flagged = items.filter((i) => i.update.status === 'flagged');

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#212121]">
      {/* Top bar */}
      <header className="bg-[#212121] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#242424] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-medium text-base leading-none">
                hyderabad<span className="text-white">.properties</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#AAAAAA] mt-1">Review desk · approve before live</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" className="hidden sm:inline-flex font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA] hover:text-white items-center gap-1 px-2">
              Public site <ExternalLink className="w-3 h-3" />
            </a>
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA] px-2">{user}</span>
            <button type="button" onClick={logout} aria-label="Sign out" className="p-2 rounded-full hover:bg-[#242424] cursor-pointer">
              <LogOut className="w-4 h-4 text-[#AAAAAA]" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pending review', value: stats.pending },
            { label: 'With paralegal', value: stats.flagged },
            { label: 'Pushed live (7d)', value: stats.approved7d },
            { label: 'Buyers watching', value: stats.watchers },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#eeeeee] p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">{s.label}</div>
              <div className="font-medium text-3xl tracking-tight">{s.value}</div>
            </div>
          ))}
          <div className="col-span-2 md:col-span-1 bg-[#212121] text-white rounded-2xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA]">Last sync</div>
            {stats.lastRun ? (
              <>
                <div className="font-medium text-lg text-white">{fmtTime(stats.lastRun.startedAt)}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA]">
                  {stats.lastRun.mode} · {stats.lastRun.trigger} · {stats.lastRun.stats.queued ?? 0} queued
                </div>
              </>
            ) : (
              <div className="font-medium text-lg text-white">Never</div>
            )}
          </div>
        </section>

        {/* Controls */}
        <section className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Sync mode" className="inline-flex p-1 rounded-full bg-white border border-[#eeeeee] gap-1">
            {(['simulate', 'live'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-bold cursor-pointer ${
                  mode === m ? 'bg-[#212121] text-white ring-2 ring-[#212121] ring-offset-1' : 'text-[#6b6b6b] hover:text-[#212121]'
                }`}
              >
                {m === 'simulate' ? 'Demo notices' : 'Live portals'}
              </button>
            ))}
          </div>
          <AelineButton variant="dark" onClick={runSync} disabled={syncing}>
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={2} />
              {syncing ? 'Syncing' : 'Run sync now'}
            </span>
          </AelineButton>
          <button
            type="button"
            onClick={() => setShowIntake(!showIntake)}
            className="px-4 py-2 rounded-full border border-[#212121] font-mono text-[11px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5 cursor-pointer min-h-[40px] hover:bg-white"
          >
            <ClipboardPaste className="w-3.5 h-3.5" strokeWidth={2} />
            Read a notice
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">
            AI reader: {claudeEnabled ? 'Claude' : 'rules fallback (add ANTHROPIC_API_KEY)'}
          </span>
        </section>

        {showIntake && <NoticeIntake projects={initialSources} onQueued={reload} />}

        {/* Tabs */}
        <nav className="flex gap-1 p-1 rounded-full bg-white border border-[#eeeeee] w-fit">
          {(
            [
              ['queue', `Queue (${items.length})`],
              ['history', 'History'],
              ['sources', 'Sources'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                if (t === 'history' && !history) loadHistory();
              }}
              className={`px-4 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider font-bold cursor-pointer ${
                tab === t ? 'bg-[#212121] text-white' : 'text-[#6b6b6b] hover:text-[#212121]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            {tab === 'queue' && (
              <>
                {pending.length === 0 && flagged.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#eeeeee] p-10 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#f2f2f2] flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5 text-[#212121]" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-medium text-lg">Queue is clear</h3>
                    <p className="text-xs text-[#6b6b6b]">Run a sync or read a notice to pull in new records.</p>
                  </div>
                )}
                {pending.map((item) => (
                  <ReviewCard key={item.update.id} item={item} onDone={handleDone} />
                ))}
                {flagged.length > 0 && (
                  <>
                    <h3 className="font-mono text-[11px] uppercase tracking-widest font-bold text-[#6b6b6b] pt-4">With paralegal ({flagged.length})</h3>
                    {flagged.map((item) => (
                      <ReviewCard key={item.update.id} item={item} onDone={handleDone} />
                    ))}
                  </>
                )}
              </>
            )}

            {tab === 'history' && (
              <div className="bg-white rounded-2xl border border-[#eeeeee] divide-y divide-[#E2E2E2]">
                {!history && <p className="p-6 text-xs text-[#6b6b6b]">Loading</p>}
                {history?.length === 0 && <p className="p-6 text-xs text-[#6b6b6b]">No reviewed updates yet.</p>}
                {history?.map((i) => (
                  <div key={i.update.id} className="p-4 sm:p-5 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={i.update.status === 'approved' ? 'lime' : 'light'}>{i.update.status}</Pill>
                      <Pill>{SOURCE_LABEL[i.update.source]}</Pill>
                      <span className="font-medium text-sm">{i.live?.name ?? i.market?.name}</span>
                      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">
                        {i.update.reviewedBy} · {fmtTime(i.update.reviewedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#212121]">{i.update.aiSummaryWhatChanged}</p>
                    {i.update.reviewerNote && <p className="text-xs text-[#6b6b6b]">Note: {i.update.reviewerNote}</p>}
                    {i.update.status === 'approved' && i.live && (
                      <a href={`/project?id=${i.live.id}`} target="_blank" className="font-mono text-[10px] uppercase tracking-wider font-bold underline decoration-[#212121] decoration-2 underline-offset-2">
                        Live report ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'sources' && <SourcesPanel rows={initialSources} />}
          </div>

          {/* Delivery log */}
          <aside className="bg-white rounded-2xl border border-[#eeeeee] p-4 space-y-3 xl:sticky xl:top-6">
            <h3 className="font-mono text-[11px] uppercase tracking-widest font-bold">Alert delivery log</h3>
            {notificationsLog.length === 0 && <p className="text-xs text-[#6b6b6b]">No alerts sent yet.</p>}
            <ul className="space-y-2">
              {notificationsLog.map((n) => (
                <li key={n.id} className="text-xs flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{n.contact}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">
                      {n.channel} · {fmtTime(n.createdAt)}
                    </div>
                    {n.error && <div className="text-[10px] text-rose-700 break-words">{n.error}</div>}
                  </div>
                  <Pill tone={n.status === 'sent' ? 'lime' : n.status === 'failed' ? 'dark' : 'light'}>{n.status}</Pill>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
              &ldquo;Logged&rdquo; means no WhatsApp webhook or email key is configured yet, so the message was recorded instead of sent.
            </p>
          </aside>
        </div>
      </main>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 bg-[#212121] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-md">
          <span className="w-2 h-2 rounded-full bg-[#212121] shrink-0" />
          <span className="text-xs sm:text-sm">{toast.msg}</span>
          {toast.url && (
            <a href={toast.url} target="_blank" className="shrink-0 px-3 py-1 rounded-full bg-[#212121] text-white font-mono text-[10px] uppercase tracking-wider font-bold">
              View ↗
            </a>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="text-[#AAAAAA] hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
