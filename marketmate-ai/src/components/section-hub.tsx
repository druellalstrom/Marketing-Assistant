import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export function SectionHub({ title, description, links }: { title: string; description: string; links: { href: string; title: string; description: string }[] }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card transition hover:border-brand">
            <h2 className="font-semibold">{l.title}</h2>
            <p className="mt-1 text-sm text-muted">{l.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
