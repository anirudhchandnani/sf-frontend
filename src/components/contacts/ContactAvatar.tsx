import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

/**
 * Profile picture when the contact has one, otherwise an initials bubble tinted
 * with a hue derived from their email. The fallback is the point: a contact
 * without a photo still reads as a person, never as a broken image.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email"> &
    Partial<Pick<Contact, "photo">>;
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data: URL, nothing for next/image to optimise
      <img
        src={contact.photo}
        alt=""
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full object-cover aspect-square ring-1 ring-hairline ${SIZES[size]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold ${SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
