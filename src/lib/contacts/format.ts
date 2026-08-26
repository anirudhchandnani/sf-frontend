import { ADDRESS_TYPE_ORDER, type Address, type AddressType, type Contact } from "./types";

/** Presentation helpers shared by the list, the detail page, and the cards. */

/**
 * First visible character of a string, counted in grapheme clusters.
 *
 * `str.at(0)` returns one UTF-16 code unit, which splits any character outside
 * the BMP — an emoji or a name starting with 𝒜 comes back as half a surrogate
 * pair and renders as a replacement glyph. Segmenter also keeps ZWJ sequences
 * (👨‍👩‍👧) and combining accents together.
 */
function firstGrapheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    return segmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? "";
  }

  // Code-point fallback: still correct for emoji, just not for ZWJ sequences.
  return Array.from(trimmed)[0] ?? "";
}

/** Up to two letters for the avatar bubble. */
export function initials(contact: Pick<Contact, "first_name" | "last_name">) {
  return `${firstGrapheme(contact.first_name)}${firstGrapheme(contact.last_name)}`
    .toUpperCase()
    .trim();
}

/**
 * Stable hue per contact so the same person keeps the same avatar colour
 * across renders and machines (no randomness, no hydration mismatch).
 */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

// Rendered on the server and hydrated on the client, so pin the locale and zone
// rather than letting each side pick its own and mismatch.
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${TIMESTAMP_FORMAT.format(date)} UTC`;
}

/** "Ada Lovelace · Mathematician at Analytical Engines"-style subtitle. */
export function jobLine(
  contact: Pick<Contact, "job_title" | "company">,
): string | null {
  if (contact.job_title && contact.company) {
    return `${contact.job_title} at ${contact.company}`;
  }
  return contact.job_title ?? contact.company ?? null;
}

/** Single-line postal address, skipping the parts that are not filled in. */
export function addressLine(address: Address): string | null {
  const parts = [
    address.street,
    address.city,
    [address.state, address.postal_code].filter(Boolean).join(" "),
    address.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length ? parts.join(", ") : null;
}

/**
 * Bucket a contact's addresses by type, in a fixed display order and skipping
 * empty groups. Driven by ADDRESS_TYPE_ORDER so a fourth type needs no new
 * rendering branch.
 */
export function groupAddressesByType(
  addresses: Address[],
): Array<{ type: AddressType; addresses: Address[] }> {
  return ADDRESS_TYPE_ORDER.map((type) => ({
    type,
    addresses: addresses.filter((address) => address.type === type),
  })).filter((group) => group.addresses.length > 0);
}
