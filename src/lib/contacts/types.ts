/**
 * Types mirroring the Contacts API OpenAPI 3.1 document (`GET /openapi.json`).
 * Field names stay snake_case so payloads map 1:1 onto the wire format.
 */

/** What an address is for. Mirrors the API's `AddressType` enum. */
export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

/** Order the detail page groups addresses in. */
export const ADDRESS_TYPE_ORDER = ADDRESS_TYPES;

/** `AddressCreate` — one address as sent to the API. */
export interface AddressInput {
  type: AddressType;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

/** `AddressRead` — a stored address, always nested inside its contact. */
export interface Address extends AddressInput {
  id: number;
  contact_id: number;
}

/** `ContactRead` — a stored contact, as returned by every contact endpoint. */
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  notes: string | null;
  /** Every address for this contact. A contact may have none. */
  addresses: Address[];
  /** Profile picture as a base64 data URL, or null to fall back to initials. */
  photo: string | null;
  created_at: string;
  updated_at: string;
  full_name: string;
}

/**
 * Every editable field, i.e. `ContactCreate` / `ContactReplace`.
 *
 * `addresses` is narrowed to `AddressInput[]`: writes carry no ids, since the
 * server assigns them and a full replace rebuilds the whole set.
 */
export type ContactInput = Omit<
  Contact,
  "id" | "created_at" | "updated_at" | "full_name" | "addresses"
> & { addresses: AddressInput[] };

/** The scalar contact fields — everything the flat text form covers. */
export type ContactScalarInput = Omit<ContactInput, "addresses">;

/** `ContactPage` — one page of contacts plus the totals needed to paginate. */
export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/** `HealthResponse` — result of the liveness probe. */
export interface HealthResponse {
  status: string;
  database: string;
  contacts: number;
}

/** Sort fields the API's allow-list accepts. */
export const SORT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "company",
  "created_at",
  "updated_at",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Bounds the API enforces on `limit`. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 200;
export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Result of a server action, consumed by `useActionState` in the forms.
 * Lives here (not in the `"use server"` module) so client components can import
 * the type without pulling server code into the browser bundle.
 */
export type FormState = {
  status: "idle" | "error";
  /** Message shown above the form; used for API-level failures. */
  message?: string;
  /** Per-field messages keyed by input name. */
  fieldErrors?: Partial<Record<keyof ContactScalarInput, string>>;
  /** Echo of the submitted values so the form survives a failed round trip. */
  values?: Partial<Record<keyof ContactScalarInput, string>>;
  /** Echo of the submitted addresses, so repeated rows survive too. */
  addressValues?: AddressInput[];
  /** Message shown against a specific address row, keyed by its index. */
  addressErrors?: Record<number, string>;
};

export const EMPTY_FORM_STATE: FormState = { status: "idle" };
