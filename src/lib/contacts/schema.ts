import { z } from "zod";
import {
  ADDRESS_TYPES,
  type AddressInput,
  type ContactScalarInput,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/**
 * Accepted `photo` payloads, mirroring the API's allow-list. Kept in sync with
 * `ALLOWED_PHOTO_TYPES` in the backend's `app/schemas.py`.
 */
export const PHOTO_DATA_URL_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

/** Cap on the decoded image, matching `MAX_PHOTO_BYTES` on the API. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  photo: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || PHOTO_DATA_URL_RE.test(value),
      "Photo must be a PNG, JPEG, GIF, or WebP image",
    )
    .transform((value) => value || null)
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactScalarInput, unknown>;

/** One address row. Every part is optional; the type is not. */
export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const addressListSchema = z.array(addressInputSchema);

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactScalarInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactScalarInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof ContactScalarInput] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: keyof ContactScalarInput;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/**
 * Pull the contact fields out of a submitted form, as raw strings.
 *
 * `CONTACT_FIELDS` only covers the text inputs rendered from `CONTACT_FIELD_GROUPS`.
 * `photo` is not one of them — it comes from `PhotoField`'s hidden input — so it has
 * to be read explicitly. Saving is a full replace (PUT), so anything missing here is
 * sent as absent and the API nulls it: leaving `photo` out would silently wipe a
 * contact's picture every time someone edited their name.
 */
export function formDataToValues(
  formData: FormData,
): Record<keyof ContactScalarInput, string> {
  return {
    ...(Object.fromEntries(
      CONTACT_FIELDS.map((field) => [
        field.name,
        String(formData.get(field.name) ?? ""),
      ]),
    ) as Record<keyof ContactScalarInput, string>),
    photo: String(formData.get("photo") ?? ""),
  };
}

/** Matches `addresses[0][street]` and captures the index and the field. */
const ADDRESS_KEY_RE = /^addresses\[(\d+)]\[(\w+)]$/;

/**
 * Pull the repeated address rows out of a submitted form.
 *
 * `FormData` is flat, so a list needs indexed input names. `formData.get()`
 * returns only the first value for a repeated key, which would silently keep
 * one address and drop the rest — hence walking the entries instead.
 *
 * Indices are sorted numerically and then compacted, so removing the middle
 * row of three still yields a contiguous list.
 */
export function formDataToAddresses(formData: FormData): unknown[] {
  const rows = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const match = ADDRESS_KEY_RE.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    row[match[2]] = String(value);
    rows.set(index, row);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);
}

/** Collapse a ZodError over an address array into one message per row index. */
export function zodAddressErrors(error: z.ZodError): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const issue of error.issues) {
    const index = issue.path[0];
    if (typeof index === "number" && !(index in errors)) {
      const field = issue.path[1];
      errors[index] =
        typeof field === "string" ? `${field}: ${issue.message}` : issue.message;
    }
  }
  return errors;
}
