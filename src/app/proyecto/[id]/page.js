import ProjectWorkspace from '@/components/ProjectWorkspace';

export default async function ProjectPage({ params }) {
  const { id } = await params;
  return (
    <main className="page">
      <ProjectWorkspace projectId={id} />
    </main>
  );
}
