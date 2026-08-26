import Link from "next/link";
import { Pencil } from "lucide-react";
import ContactAvatar from "./ContactAvatar";
import DeleteContactButton from "./DeleteContactButton";
import SortHeader from "./SortHeader";
import { buttonClasses } from "@/components/ui/Button";
import { jobLine } from "@/lib/contacts/format";
import type { ContactListQuery } from "@/lib/contacts/query";
import type { ContactListItem } from "@/lib/contacts/types";

/** The contacts list. Narrow screens drop the phone and company columns. */
export default function ContactsTable({
  contacts,
  query,
}: {
  contacts: ContactListItem[];
  query: ContactListQuery;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Contacts, sorted by {query.sortBy.replace("_", " ")} {query.order}
        </caption>
        <thead className="border-b border-hairline bg-secondary/40 text-left text-[13px] font-medium">
          <tr>
            <SortHeader field="last_name" label="Name" query={query} />
            <SortHeader field="email" label="Email" query={query} />
            <th scope="col" className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
              Phone
            </th>
            <SortHeader
              field="company"
              label="Company"
              query={query}
              className="hidden lg:table-cell"
            />
            <th scope="col" className="px-4 py-2.5 text-right text-muted-foreground">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {contacts.map((contact) => {
            const subtitle = jobLine(contact);

            return (
              <tr
                key={contact.id}
                className="border-b border-hairline last:border-b-0 transition-colors hover:bg-secondary/30"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <ContactAvatar contact={contact} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="block truncate font-medium text-foreground hover:text-primary"
                      >
                        {contact.full_name}
                      </Link>
                      {subtitle ? (
                        <span className="block truncate text-[12px] text-muted-foreground lg:hidden">
                          {subtitle}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td className="max-w-[16rem] px-4 py-2.5">
                  <a
                    href={`mailto:${contact.email}`}
                    className="block truncate text-muted-foreground hover:text-primary"
                  >
                    {contact.email}
                  </a>
                </td>

                <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted-foreground sm:table-cell">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="hover:text-primary">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>

                <td className="hidden max-w-[14rem] px-4 py-2.5 text-muted-foreground lg:table-cell">
                  <span className="block truncate">
                    {contact.company ?? (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </span>
                </td>

                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/contacts/${contact.id}/edit`}
                      aria-label={`Edit ${contact.full_name}`}
                      className={buttonClasses("ghost", "sm")}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                    <DeleteContactButton
                      contactId={contact.id}
                      contactName={contact.full_name}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
