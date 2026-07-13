import { WorkflowForm } from "@/components/workflows/WorkflowForm";

export default function NewWorkflowPage() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-foreground-muted)]">
        Define an ordered list of steps, then save and run it.
      </p>
      <WorkflowForm />
    </div>
  );
}
