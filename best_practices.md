# Best Practices — Contacts UI

Project-specific review guidance for this Next.js App Router + Tailwind frontend.
Applies to `src/lib/contacts/`, `src/components/contacts/`, `src/app/contacts/`.

## Thread every new contact field through all three form layers

A field on the `Contact` type is not enough. Form data reaches the API through
`CONTACT_FIELD_GROUPS` → `contactInputSchema` → `formDataToValues`, and each one drops
anything it does not know about. Because saving is a full replace (PUT), a field missing
from any layer is sent as absent and the API nulls it — so editing a contact's name
silently erases data the user never touched. Adding a field means editing all three.

Example code before:

```ts
// types.ts — field added
export interface Contact {
  photo: string | null;
}

// schema.ts — but not here, so parsing strips it and PUT nulls it
export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
});
```

Example code after:

```ts
export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  photo: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

// formDataToValues iterates CONTACT_FIELDS, which only covers text inputs.
// Non-text fields must be read explicitly so they survive the round trip.
export function formDataToValues(formData: FormData) {
  return {
    ...Object.fromEntries(
      CONTACT_FIELDS.map((f) => [f.name, String(formData.get(f.name) ?? "")]),
    ),
    photo: String(formData.get("photo") ?? ""),
  } as Record<keyof ContactInput, string>;
}
```

## Seed edit forms from the existing record so a partial edit never drops data

Any field not rendered as an input in the edit form arrives empty on submit and is
replaced with null. Fields the user does not directly edit still need to be carried,
typically through a hidden input primed with the current value.

Example code before:

```tsx
<input type="file" accept="image/*" onChange={handleFile} />
```

Example code after:

```tsx
<input type="file" accept="image/*" onChange={handleFile} />
{/* carries the existing value when the user does not pick a new file */}
<input type="hidden" name="photo" value={photo ?? ""} />
```

## Layer the fallback behind the richer representation, do not branch between them

Optional presentation data must degrade, not disappear. Branching on whether a photo *exists*
handles only one failure: an image that is present but undecodable still renders as a broken
icon, and a fully transparent one renders as an empty ring. Render the fallback always and put
the image on top of it, so a decode failure reveals the fallback and transparency shows it
through.

Example code before:

```tsx
// Either/or: nothing left to fall back to once the <img> is chosen.
if (contact.photo) {
  return <img src={contact.photo} className="rounded-full" alt="" />;
}
return <span className="contact-avatar">{initials(contact)}</span>;
```

Example code after:

```tsx
// Track which source failed, not a boolean: a changed src is then retried
// automatically, with no effect needed to reset the flag.
const [failedSrc, setFailedSrc] = useState<string | null>(null);
const failed = src !== null && failedSrc === src;

return (
  <span aria-hidden="true" className={`contact-avatar relative overflow-hidden ${SIZES[size]}`}>
    {initials(contact)}
    {src && !failed ? (
      <img
        src={src}
        alt=""
        onError={() => setFailedSrc(src)}
        className="absolute inset-0 h-full w-full rounded-full object-cover aspect-square"
      />
    ) : null}
  </span>
);
```

## Do not ship a large field to a list just to render a thumbnail

A value that is reasonable on one record is not reasonable on a page of them. Base64 images
inlined into a collection response make the payload grow without bound — and the rendered page
carries them twice, once in the HTML and once in the RSC flight data. Take a flag from the list
endpoint and load the asset from its own URL.

Example code before:

```tsx
<ContactAvatar contact={contact} />   // contact.photo is 2 MB of base64
```

Example code after:

```tsx
// The list carries has_photo; the bytes come from a route that can be cached.
const src =
  contact.photo ??
  (contact.has_photo && contact.id ? `/api/contacts/${contact.id}/photo/` : null);
```

Mind the app's `trailingSlash` setting when building such a URL — a mismatch turns every
image request into a 308 redirect plus a second round trip.

## Validate uploads in the browser before encoding them

Reading an arbitrary file into a base64 data URL with no checks lets a user push a 40 MB
video into a text column. Check type and size against the same limits the API enforces,
and surface a message instead of failing at submit time.

Example code before:

```ts
const reader = new FileReader();
reader.onload = () => setPhoto(String(reader.result));
reader.readAsDataURL(file);
```

Example code after:

```ts
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

if (!ACCEPTED.includes(file.type)) {
  setError("Choose a PNG, JPEG, GIF, or WebP image.");
  return;
}
if (file.size > MAX_BYTES) {
  setError("That image is larger than 2 MB.");
  return;
}
const reader = new FileReader();
reader.onerror = () => setError("Could not read that file.");
reader.onload = () => setPhoto(String(reader.result));
reader.readAsDataURL(file);
```

## Name repeatable form rows with indexed keys so a list survives FormData

`FormData` is flat. A list of sub-records needs indexed names, and the parser must walk the
indices rather than calling `get()` on a single key — which would silently keep only the
first row.

Example code before:

```tsx
{addresses.map((address) => (
  <input name="street" defaultValue={address.street} />
))}
```

Example code after:

```tsx
{addresses.map((address, index) => (
  <div key={address.key}>
    <select name={`addresses[${index}][type]`} defaultValue={address.type}>
      <option value="Home">Home</option>
      <option value="Work">Work</option>
      <option value="Other">Other</option>
    </select>
    <input name={`addresses[${index}][street]`} defaultValue={address.street ?? ""} />
  </div>
))}
```

```ts
export function formDataToAddresses(formData: FormData): AddressInput[] {
  const rows = new Map<number, Record<string, string>>();
  for (const [key, value] of formData.entries()) {
    const match = /^addresses\[(\d+)]\[(\w+)]$/.exec(key);
    if (!match) continue;
    const [, index, field] = match;
    const row = rows.get(Number(index)) ?? {};
    row[field] = String(value);
    rows.set(Number(index), row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row as AddressInput);
}
```

## Keep `"use client"` at the leaf that needs interactivity

This app renders contacts on the server. Marking a page or a large section as a client
component to add one file input pulls data fetching into the browser and loses the server
render. Put the directive on the smallest interactive component and keep its parents as
server components.

Example code before:

```tsx
"use client";
export default function ContactDetailPage({ params }) {
  const [photo, setPhoto] = useState<string | null>(null);
}
```

Example code after:

```tsx
// PhotoField.tsx — only this leaf is interactive
"use client";
export default function PhotoField({ defaultValue }: { defaultValue: string | null }) {
  const [photo, setPhoto] = useState(defaultValue);
}
```

```tsx
// page.tsx stays a server component and just mounts it
export default async function ContactDetailPage({ params }) {
  const contact = await getContact(Number((await params).id));
  return <PhotoField defaultValue={contact.photo} />;
}
```

## Derive grouped views from data instead of hardcoding a rendered order

Grouping addresses by type should iterate a declared order constant and skip empty groups,
so adding a fourth type is a one-line change rather than a new JSX block.

Example code before:

```tsx
<h3>Home</h3>
{addresses.filter((a) => a.type === "Home").map(renderAddress)}
<h3>Work</h3>
{addresses.filter((a) => a.type === "Work").map(renderAddress)}
```

Example code after:

```tsx
const ADDRESS_TYPE_ORDER = ["Home", "Work", "Other"] as const;

{ADDRESS_TYPE_ORDER.map((type) => {
  const group = addresses.filter((address) => address.type === type);
  if (group.length === 0) return null;
  return (
    <section key={type}>
      <h3>{type}</h3>
      {group.map(renderAddress)}
    </section>
  );
})}
```

## Assert the data-preserving path in component tests

The regressions worth catching are the silent ones. A test that only checks a field renders
will pass while an edit quietly wipes it. Assert what the submitted payload contains.

Example code before:

```tsx
it("renders the photo", () => {
  render(<ContactForm contact={contactWithPhoto} />);
  expect(screen.getByRole("img")).toBeInTheDocument();
});
```

Example code after:

```tsx
it("keeps the existing photo when only the name is edited", async () => {
  render(<ContactForm contact={contactWithPhoto} />);
  await userEvent.clear(screen.getByLabelText(/first name/i));
  await userEvent.type(screen.getByLabelText(/first name/i), "Ada");
  await userEvent.click(screen.getByRole("button", { name: /save/i }));

  expect(submittedPayload.photo).toBe(contactWithPhoto.photo);
});
```
