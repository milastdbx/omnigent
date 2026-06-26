/**
 * Entities page (`/entities`).
 *
 * Manages reusable entities — `{ id, title, instruction }` building blocks that
 * can be wired into any flow as a step (see {@link entityStore}). Seeded with
 * the Jira actions; users can add, edit, and delete entities. The `instruction`
 * is the text folded into a flow's narrative when the entity is used.
 *
 * Existing *jobs* are also usable as entities in the builder, but those are
 * managed on the Jobs page — this page is only for the standalone entities.
 */

import { useState } from "react";
import { PlusIcon, Trash2Icon, BlocksIcon } from "lucide-react";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import {
  createEntity,
  deleteEntity,
  updateEntity,
  useEntities,
  type Entity,
} from "@/lib/entityStore";

function EntityCard({ entity }: { entity: Entity }) {
  const [title, setTitle] = useState(entity.title);
  const [instruction, setInstruction] = useState(entity.instruction);
  const dirty = title !== entity.title || instruction !== entity.instruction;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <BlocksIcon className="mt-1 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instruction text (folded into the flow when this entity is used)"
            rows={2}
            className="w-full resize-y rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{entity.id}</span>
            <span className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || !title.trim()}
              onClick={() => updateEntity(entity.id, { title: title.trim(), instruction: instruction.trim() })}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete entity"
              onClick={() => {
                if (window.confirm(`Delete “${entity.title}”?`)) deleteEntity(entity.id);
              }}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EntitiesPage() {
  const entities = useEntities();

  return (
    <PageScroll contentClassName="px-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entities</h1>
        <Button onClick={() => createEntity("New entity", "")}>
          <PlusIcon className="size-4" /> New entity
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Reusable building blocks you can wire into any flow as a step. Each has a title and an
        instruction that becomes part of the flow when used.
      </p>

      {entities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <BlocksIcon className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No entities yet</p>
          <Button className="mt-2" variant="outline" onClick={() => createEntity("New entity", "")}>
            <PlusIcon className="size-4" /> New entity
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entities.map((e) => (
            <EntityCard key={e.id} entity={e} />
          ))}
        </div>
      )}
    </PageScroll>
  );
}
