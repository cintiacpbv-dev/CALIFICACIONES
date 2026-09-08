import ProjectPanel from '@/components/ProjectPanel';

export const metadata = { title: 'Proyectos' };

export default function HomePage() {
  return (
    <>
      <header className="appbar">
        <span className="brand">
          <span className="brand-mark">F0</span>
          <span className="brand-name">Letalidad térmica</span>
        </span>
      </header>

      <main className="page">
        <ProjectPanel />
      </main>
    </>
  );
}
