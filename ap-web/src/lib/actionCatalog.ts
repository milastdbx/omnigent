/**
 * Action catalog — the groups of ready-made steps the builder's "+" menu offers
 * alongside the generic node types.
 *
 * Groups are now sourced from two real, persisted places (no more hardcoded
 * mock):
 *
 *  - **Entities** (`entityStore`) — saved `{id, title, instruction}` building
 *    blocks, e.g. the Jira actions. Grouped under "Entities".
 *  - **Jobs** (`jobsStore`) — every existing job, usable as a step in another
 *    flow (its instruction is the job's narrative). Grouped under "Jobs". The
 *    current job is excluded to avoid wiring a flow into itself.
 *
 * Each pickable item is an {@link ActionDef} carrying the `instruction` text
 * that gets folded into the flow when used; a step records the action's id +
 * group, and the builder uses the instruction as the step label/source.
 */

import { useMemo } from "react";
import { useEntities } from "@/lib/entityStore";
import { useJobs } from "@/lib/jobsStore";
import { treeToGraph } from "@/lib/flowTree";
import { generateFlowText } from "@/lib/flowToText";

export interface ActionDef {
  /** Stable identifier, e.g. an entity id or "job:<jobId>". */
  id: string;
  /** Display label shown in the step box. */
  label: string;
  /** Short description (tooltip). */
  description?: string;
  /** Instruction text folded into the flow narrative when used. */
  instruction: string;
}

export interface ActionGroup {
  /** Stable group id, e.g. "entities" or "jobs". */
  id: string;
  /** Display name. */
  name: string;
  actions: ActionDef[];
}

/**
 * Reactive catalog: saved entities + existing jobs, as pickable groups.
 *
 * @param excludeJobId - a job id to omit from the Jobs group (the job being
 *   edited, so it can't be wired into itself).
 */
export function useActionCatalog(excludeJobId?: string): {
  groups: ActionGroup[];
  loading: boolean;
} {
  const entities = useEntities();
  const jobs = useJobs();

  const groups = useMemo<ActionGroup[]>(() => {
    const out: ActionGroup[] = [];

    if (entities.length) {
      out.push({
        id: "entities",
        name: "Entities",
        actions: entities.map((e) => ({
          id: e.id,
          label: e.title,
          description: e.instruction,
          instruction: e.instruction,
        })),
      });
    }

    const jobActions = jobs
      .filter((j) => j.id !== excludeJobId)
      .map((j) => {
        // A job's instruction is the narrative rendered from its flow.
        const instruction = generateFlowText(treeToGraph(j.tree)).narrative || `Run the “${j.name}” flow.`;
        return {
          id: `job:${j.id}`,
          label: j.name,
          description: "Existing job, wired in as a step.",
          instruction,
        };
      });
    if (jobActions.length) {
      out.push({ id: "jobs", name: "Jobs", actions: jobActions });
    }

    return out;
  }, [entities, jobs, excludeJobId]);

  // Sourced from local stores/hooks — always ready, no async load.
  return { groups, loading: false };
}
