"use client";

import { useState, type CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

/** What the avatar can render from: an inline data URL, or a fetchable URL. */
type AvatarSource = Pick<Contact, "first_name" | "last_name" | "email"> &
  Partial<Pick<Contact, "photo">> & { id?: number; has_photo?: boolean };

/**
 * Profile picture when the contact has one, initials otherwise.
 *
 * The initials always render, and the photo sits on top of them. That ordering
 * is deliberate: a transparent PNG shows the initials through it instead of
 * leaving an empty ring, and an image that fails to decode is hidden by the
 * error handler so the initials are simply revealed. Testing `photo` for
 * truthiness alone used to leave a blank circle in both cases.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: AvatarSource;
  size?: keyof typeof SIZES;
}) {
  // Prefer the inline value when the caller has it (the detail page), otherwise
  // fetch it — list responses carry has_photo rather than megabytes of base64.
  const src =
    contact.photo ??
    (contact.has_photo && contact.id ? `/api/contacts/${contact.id}/photo` : null);

  // Remember which source failed rather than a bare boolean: a new src is then
  // retried automatically, with no effect needed to reset the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src !== null && failedSrc === src;

  const style = { "--avatar-hue": avatarHue(contact.email) } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display font-semibold ${SIZES[size]}`}
    >
      {initials(contact)}
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL or a proxied stream, nothing for next/image to optimise
        <img
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 h-full w-full rounded-full object-cover aspect-square"
        />
      ) : null}
    </span>
  );
}
