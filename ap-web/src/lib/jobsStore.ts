/**
 * Jobs persistence (browser localStorage).
 *
 * A *job* is a named, saved flow chart. The Jobs page lists jobs; opening one
 * launches the flow builder on its saved {@link FlowGraph}, and saving in the
 * builder writes back to the same job. Storage is intentionally client-side
 * only (one `localStorage` key) — no server/API involvement — mirroring the
 * original standalone prototype's persistence model.
 *
 * The module is framework-agnostic (plain functions over `localStorage`); the
 * React layer wraps it with {@link useJobs} for reactive reads.
 */

import { useCallback, useEffect, useState } from "react";
import { countSteps, newTree, type FlowStep } from "@/lib/flowTree";

const STORAGE_KEY = "omnigent-jobs-v1";

export type RunStatus = "running" | "succeeded" | "failed";

/**
 * One execution of a job's flow. "Running" is a stand-in for some backend
 * process — here it's simulated client-side (see {@link runJob}), but the shape
 * mirrors what a real run record would carry: timing, status, and a few log
 * lines.
 */
export interface Run {
  id: string;
  /** 1-based, per-job, monotonically increasing. */
  number: number;
  status: RunStatus;
  /** Epoch ms. */
  startedAt: number;
  /** Epoch ms; undefined while still running. */
  finishedAt?: number;
  /** Human-readable progress/log lines surfaced in the Runs view. */
  logs: string[];
}

export interface Job {
  id: string;
  name: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
  /** The flow this job runs, as a top-down step tree (the builder's model). */
  tree: FlowStep;
  /** Execution history, newest last (kept in start order; views sort). */
  runs: Run[];
}

/** Cross-tab + same-tab change signal so `useJobs` can re-read. */
const EVENT = "omnigent-jobs-changed";

function readAll(): Job[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate partially-shaped entries from older writes (e.g. pre-tree jobs
    // that stored a flat `graph` get a fresh Start-only tree rather than crash).
    return parsed
      .filter((j): j is Job => j && typeof j.id === "string" && typeof j.name === "string")
      .map((j) => ({
        ...j,
        tree: j.tree ?? newTree(),
        runs: Array.isArray(j.runs) ? j.runs : [],
      }));
  } catch {
    return [];
  }
}

function writeAll(jobs: Job[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Quota / disabled storage — nothing actionable; the in-memory list still
    // reflects the change for this session.
  }
  // Notify same-tab listeners (the native `storage` event only fires in OTHER
  // tabs). `CustomEvent` is fine in every browser the app targets.
  window.dispatchEvent(new Event(EVENT));
}

const uid = (p = "job") =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function listJobs(): Job[] {
  // Newest first.
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getJob(id: string): Job | undefined {
  return readAll().find((j) => j.id === id);
}

export function createJob(name: string, tree: FlowStep = newTree()): Job {
  const now = Date.now();
  const job: Job = {
    id: uid(),
    name: name.trim() || "Untitled flow",
    createdAt: now,
    updatedAt: now,
    tree,
    runs: [],
  };
  writeAll([...readAll(), job]);
  return job;
}

/** Patch name and/or tree; bumps `updatedAt`. No-op if the id is unknown. */
export function updateJob(id: string, patch: Partial<Pick<Job, "name" | "tree">>): void {
  const jobs = readAll();
  const i = jobs.findIndex((j) => j.id === id);
  if (i === -1) return;
  jobs[i] = { ...jobs[i], ...patch, updatedAt: Date.now() };
  writeAll(jobs);
}

export function deleteJob(id: string): void {
  writeAll(readAll().filter((j) => j.id !== id));
}

/** The most recent run for a job (by start time), or undefined if never run. */
export function latestRun(job: Job): Run | undefined {
  if (!job.runs.length) return undefined;
  return job.runs.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
}

/** Append a run to a job and persist. Internal helper for {@link runJob}. */
function patchRun(jobId: string, run: Run): void {
  const jobs = readAll();
  const i = jobs.findIndex((j) => j.id === jobId);
  if (i === -1) return;
  const others = jobs[i].runs.filter((r) => r.id !== run.id);
  jobs[i] = { ...jobs[i], runs: [...others, run] };
  writeAll(jobs);
}

/**
 * "Run" a job's flow. Running is a stand-in for some backend process — this
 * simulates it client-side: a run record is created in `running` state, a short
 * delay elapses, then it resolves to `succeeded` (or `failed` for a chart with
 * no nodes — nothing to execute). Each phase persists so the Runs view updates
 * live. Returns the terminal run record.
 *
 * Swapping this for a real backend later means replacing the body with an API
 * call + polling/stream; the Run shape and store contract stay the same.
 */
export function runJob(jobId: string): Promise<Run | undefined> {
  const job = getJob(jobId);
  if (!job) return Promise.resolve(undefined);

  const number = job.runs.reduce((max, r) => Math.max(max, r.number), 0) + 1;
  const nodeCount = countSteps(job.tree);
  // Runnable once the flow has more than the lone Start step.
  const runnable = nodeCount > 1;
  const run: Run = {
    id: uid("run"),
    number,
    status: "running",
    startedAt: Date.now(),
    logs: [`Run #${number} started`, `Loaded flow: ${nodeCount} step${nodeCount === 1 ? "" : "s"}`],
  };
  patchRun(jobId, run);

  return new Promise((resolve) => {
    // Simulated backend latency. Math.random is fine here — runs aren't
    // reproducible state, and the value only affects the fake duration.
    const delay = 600 + Math.floor(Math.random() * 900);
    setTimeout(() => {
      const finishedAt = Date.now();
      const ok = runnable;
      const finished: Run = {
        ...run,
        status: ok ? "succeeded" : "failed",
        finishedAt,
        logs: [
          ...run.logs,
          ok ? "Executing flow…" : "Nothing to execute — add at least one step after Start.",
          ok
            ? `Run #${number} succeeded in ${((finishedAt - run.startedAt) / 1000).toFixed(1)}s`
            : `Run #${number} failed`,
        ],
      };
      patchRun(jobId, finished);
      resolve(finished);
    }, delay);
  });
}

/**
 * Reactive job list — re-reads on any create/update/delete (this tab) and on
 * `localStorage` changes from other tabs.
 */
export function useJobs(): Job[] {
  const [jobs, setJobs] = useState<Job[]>(() => listJobs());
  const refresh = useCallback(() => setJobs(listJobs()), []);
  useEffect(() => {
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return jobs;
}

/**
 * Reactive single-job read, keyed by id — re-reads on any store change so the
 * builder's Runs tab reflects run progress live. Returns undefined for an
 * unknown id.
 */
export function useJob(id: string | undefined): Job | undefined {
  const [job, setJob] = useState<Job | undefined>(() => (id ? getJob(id) : undefined));
  const refresh = useCallback(() => setJob(id ? getJob(id) : undefined), [id]);
  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return job;
}
