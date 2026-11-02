// The ArkLores knowledge base: a timer on this machine keeps it up to date
// (tools/kb_bot in the ArkLores repository) and writes what it is doing to one
// JSON file. This only reads that file: nothing here can start or change a run.
import fs from 'node:fs';

export interface KnowledgeRun {
  startedAt?: string;
  finishedAt?: string;
  commit?: string;
  kind?: string;
  outcome?: string;
  summary?: string;
  stages: { name: string; at: string }[];
  storyAdded?: number;
  storyChanged?: number;
  storyRemoved?: number;
  embeddedChunks?: number;
  tables: string[];
}

export interface KnowledgeWarning {
  level: 'red' | 'yellow';
  message: string;
}

export interface KnowledgeStatus {
  configured: boolean;
  running: boolean;
  dryRun: boolean;
  stage?: string;
  detail?: string;
  progress?: { done: number; total: number };
  upstream?: string;
  published?: { commit?: string; commitDate?: string; publishedAt?: string; packCommit?: string };
  lastCheckAt?: string;
  lastOutcome?: string;
  lastSummary?: string;
  updatedAt?: string;
  runs: KnowledgeRun[];
  warnings: KnowledgeWarning[];
}

export const KNOWLEDGE_LIMITS = {
  /** The timer fires every hour: three missed checks is a problem. */
  checkHours: 3,
  /** A run that says nothing for this long has died (killed, or out of memory). */
  silentMinutes: 45,
};

export function knowledgeStatusFile(): string {
  return process.env.ARKLORES_BOT_STATUS || '/srv/arklores-bot/status/status.json';
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const count = (value: unknown) => (typeof value === 'number' ? value : undefined);

function toRun(raw: any): KnowledgeRun {
  return {
    startedAt: text(raw?.started_at),
    finishedAt: text(raw?.finished_at),
    commit: text(raw?.commit),
    kind: text(raw?.kind),
    outcome: text(raw?.outcome),
    summary: text(raw?.summary),
    stages: Array.isArray(raw?.stages) ? raw.stages.filter((s: any) => text(s?.name)).map((s: any) => ({ name: s.name, at: String(s.at ?? '') })) : [],
    storyAdded: count(raw?.changes?.story_added),
    storyChanged: count(raw?.changes?.story_changed),
    storyRemoved: count(raw?.changes?.story_removed),
    embeddedChunks: count(raw?.vectors?.embedded_chunks),
    tables: Array.isArray(raw?.tables) ? raw.tables.map(String) : [],
  };
}

/** What the bot last wrote, and what needs attention now. Never throws. */
export function knowledgeStatus(now: Date = new Date(), file: string = knowledgeStatusFile()): KnowledgeStatus {
  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { configured: false, running: false, dryRun: false, runs: [], warnings: [{ level: 'yellow', message: '还没有读到知识库更新服务的状态。' }] };
  }

  const age = (iso: string | undefined) => (iso ? now.getTime() - new Date(iso).getTime() : Infinity);
  const updatedAt = text(raw.updated_at);
  const silent = !!raw.running && age(updatedAt) > KNOWLEDGE_LIMITS.silentMinutes * 60_000;
  const running = !!raw.running && !silent;
  const lastCheckAt = text(raw.last_check_at);
  const lastOutcome = text(raw.last_outcome);
  const lastSummary = text(raw.last_summary);

  const warnings: KnowledgeWarning[] = [];
  if (silent) warnings.push({ level: 'red', message: `更新在“${text(raw.stage) ?? '运行'}”这一步之后没有再报告，可能已经中断。` });
  if (!running && (lastOutcome === 'failed' || lastOutcome === 'held') && lastSummary) warnings.push({ level: 'red', message: lastSummary });
  if (!running && age(lastCheckAt) > KNOWLEDGE_LIMITS.checkHours * 3_600_000) warnings.push({ level: 'red', message: `已经超过 ${KNOWLEDGE_LIMITS.checkHours} 小时没有检查上游。` });

  return {
    configured: true,
    running,
    dryRun: !!raw.dry_run,
    stage: running ? text(raw.stage) : undefined,
    detail: running ? text(raw.detail) : undefined,
    progress: running && count(raw.progress?.done) !== undefined && count(raw.progress?.total) ? { done: raw.progress.done, total: raw.progress.total } : undefined,
    upstream: text(raw.upstream),
    published: raw.published
      ? { commit: text(raw.published.commit), commitDate: text(raw.published.commit_date), publishedAt: text(raw.published.published_at), packCommit: text(raw.published.pack_commit) }
      : undefined,
    lastCheckAt,
    lastOutcome,
    lastSummary,
    updatedAt,
    runs: Array.isArray(raw.runs) ? raw.runs.map(toRun) : [],
    warnings,
  };
}
