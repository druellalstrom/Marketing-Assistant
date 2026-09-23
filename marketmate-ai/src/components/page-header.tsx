export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-lg text-muted">{description}</p>}
    </header>
  );
}
