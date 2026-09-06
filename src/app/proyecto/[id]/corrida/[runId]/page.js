import RunWorkspace from '@/components/RunWorkspace';

export default async function RunPage({ params }) {
  const { runId } = await params;
  return <RunWorkspace runId={runId} />;
}
