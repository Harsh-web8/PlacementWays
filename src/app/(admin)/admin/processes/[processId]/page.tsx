import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { getProcessWithChildren } from "@/server/admin/processes/queries";
import { updateProcess } from "@/server/admin/processes/actions";
import { ProcessForm } from "@/components/admin/process-form";
import { ProcessStatusActions } from "@/components/admin/process-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { StageList } from "@/components/admin/stage-list";
import { SourceList } from "@/components/admin/source-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/admin/processes/[processId]">) {
  const { processId } = await params;
  const data = await getProcessWithChildren(processId);
  return { title: data ? data.process.title : "Recruitment process" };
}

export default async function EditProcessPage({ params }: PageProps<"/admin/processes/[processId]">) {
  await requireAdmin(); // re-checked here: layouts don't re-run on every navigation
  const { processId } = await params;

  const data = await getProcessWithChildren(processId);
  if (!data) notFound();
  const { process, company, stages, sources } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href={`/admin/companies/${company.id}`} className="text-sm text-[var(--color-ink)]/60 underline underline-offset-4 hover:no-underline">
          &larr; {company.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl tracking-tight">{process.title}</h1>
            <StatusBadge status={process.status} />
          </div>
        </div>
        <div className="mt-4">
          <ProcessStatusActions process={process} companyId={company.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcessForm process={process} action={updateProcess.bind(null, process.id, company.id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment stages</CardTitle>
          <CardDescription>Shown in order on the public process page. Reorder with the arrows.</CardDescription>
        </CardHeader>
        <CardContent>
          <StageList stages={stages} processId={process.id} companyId={company.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Links backing this recruitment information, shown publicly with the last-verified date.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceList sources={sources} processId={process.id} companyId={company.id} />
        </CardContent>
      </Card>
    </div>
  );
}
