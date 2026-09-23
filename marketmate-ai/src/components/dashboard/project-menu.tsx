"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown } from "@/components/shell/dropdown";
import { deleteItem, duplicateItem } from "@/app/(app)/library/actions";
import type { LibraryKind } from "@/lib/library";

/** Open / Edit / Duplicate / Delete for a saved project — all real actions. */
export function ProjectMenu({ kind, id, title, openHref, editHref }: { kind: LibraryKind; id: string; title: string; openHref: string; editHref: string }) {
  const item = "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[0.9375rem] hover:bg-pink-50";
  return (
    <Dropdown
      label={`Actions for ${title}`}
      panelClassName="w-44"
      button={<MoreHorizontal aria-hidden className="h-6 w-6 text-muted" />}
    >
      <Link href={openHref} className={item}>Open</Link>
      <Link href={editHref} className={item}>Edit</Link>
      <form action={duplicateItem.bind(null, kind, id)}>
        <button className={item}>Duplicate</button>
      </form>
      <form
        action={deleteItem.bind(null, kind, id, "/dashboard")}
        onSubmit={(e) => {
          if (!confirm(`Delete “${title}”? This can't be undone.`)) e.preventDefault();
        }}
      >
        <button className={`${item} text-red-700`}>Delete</button>
      </form>
    </Dropdown>
  );
}
