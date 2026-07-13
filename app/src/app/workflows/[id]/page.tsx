"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { WorkflowForm } from "@/components/workflows/WorkflowForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { fetcher } from "@/lib/fetcher";
import type { Workflow } from "@/components/types";

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading, mutate } = useSWR<{ workflow: Workflow }>(
    params.id ? `/api/workflows/${params.id}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message="Could not load this workflow." onRetry={() => mutate()} />;
  }

  if (!data) return null;

  return <WorkflowForm workflow={data.workflow} />;
}
