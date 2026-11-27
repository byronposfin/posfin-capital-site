import type { BorrowerPortal } from "@/lib/portal-data";

const STATUS = { done: "Done", current: "Now", todo: "To come" } as const;

export function TaskList({ portal }: { portal: BorrowerPortal }) {
  return (
    <section className="card deck" aria-labelledby="tasks-heading">
      <p className="kicker">Towards completion</p>
      <h2 id="tasks-heading" className="address">{portal.progressPct}% complete</h2>
      <div
        className="progress bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={portal.progressPct}
        aria-label="Progress toward completion"
      >
        <span style={{ width: `${portal.progressPct}%` }} />
      </div>
      <ol className="tasks">
        {portal.tasks.map((task) => (
          <li key={task.id} data-status={task.status}>
            <span>{task.label}</span>
            <span className="pill">{STATUS[task.status]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
