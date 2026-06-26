/**
 * Entity store (server-backed).
 *
 * An *entity* is a reusable `{ id, title, instruction }` building block wired
 * into flows as a step (e.g. the Jira actions). The `instruction` is the text
 * folded into a flow's narrative when the entity is used.
 *
 * Persistence is the `/v1/entities` API (see {@link entitiesApi}); this module
 * wraps it with a small in-memory cache so the React hooks read synchronously
 * and re-render on change — the same pattern as {@link jobsStore}.
 *
 * History: this was browser-localStorage-only in the flows UI prototype. It now
 * talks to the backend so entities are shared and real.
 */

import { useCallback, useEffect, useState } from "react";
import {
  apiCreateEntity,
  apiDeleteEntity,
  apiListEntities,
  apiUpdateEntity,
  type ApiEntity,
} from "@/lib/entitiesApi";

export interface Entity {
  id: string;
  title: string;
  /** Text folded into the flow narrative when this entity is used as a step. */
  instruction: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

/** Cross-component change signal so the hooks re-read after a mutation. */
const EVENT = "omnigent-entities-changed";

/** In-memory cache so `useEntities` can read synchronously. */
const cache = new Map<string, Entity>();
let listLoaded = false;
let seeded = false;

/**
 * First-run seed — the Jira actions, created once if the backend has no
 * entities yet. Guarded so concurrent mounts / reloads don't duplicate it
 * (the empty-list check + module `seeded` flag run after the list loads).
 */
const SEED: ReadonlyArray<{ title: string; instruction: string }> = [
  {
    title: "Fetch ticket body & metadata",
    instruction: "Fetch the Jira ticket's description, status, assignee, and fields.",
  },
  {
    title: "Post an update to the ticket",
    instruction: "Post a comment or update to the Jira ticket.",
  },
  {
    title: "Resolve the ticket",
    instruction: "Transition the Jira ticket to a resolved/done state.",
  },
];

function emit(): void {
  window.dispatchEvent(new Event(EVENT));
}

function fromApi(e: ApiEntity): Entity {
  return {
    id: e.id,
    title: e.title,
    instruction: e.instruction,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function put(e: Entity): Entity {
  cache.set(e.id, e);
  return e;
}

/** Newest-updated first. */
function cachedList(): Entity[] {
  return [...cache.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function refreshList(): Promise<void> {
  let entities = await apiListEntities();
  // First run on a fresh backend: seed the Jira entities, once.
  if (entities.length === 0 && !seeded) {
    seeded = true;
    await Promise.all(SEED.map((s) => apiCreateEntity(s).catch(() => null)));
    entities = await apiListEntities();
  }
  cache.clear();
  for (const e of entities) put(fromApi(e));
  listLoaded = true;
  emit();
}

export function listEntities(): Entity[] {
  return cachedList();
}

export function getEntity(id: string): Entity | undefined {
  return cache.get(id);
}

/** Create a new entity. Returns it. */
export async function createEntity(title: string, instruction: string): Promise<Entity> {
  const e = put(fromApi(await apiCreateEntity({ title: title.trim() || "Untitled", instruction })));
  emit();
  return e;
}

/** Patch title and/or instruction. */
export async function updateEntity(
  id: string,
  patch: Partial<Pick<Entity, "title" | "instruction">>,
): Promise<void> {
  const e = fromApi(await apiUpdateEntity(id, patch));
  put(e);
  emit();
}

export async function deleteEntity(id: string): Promise<void> {
  await apiDeleteEntity(id);
  cache.delete(id);
  emit();
}

/**
 * Reactive entity list — loads from the API on first use and re-reads from the
 * cache on any create/update/delete (via the `omnigent-entities-changed` event).
 */
export function useEntities(): Entity[] {
  const [entities, setEntities] = useState<Entity[]>(() => cachedList());
  const refresh = useCallback(() => setEntities(cachedList()), []);
  useEffect(() => {
    window.addEventListener(EVENT, refresh);
    // Load the list once across the app; subsequent mounts read the cache.
    if (!listLoaded) void refreshList().catch(() => {});
    else refresh();
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);
  return entities;
}
