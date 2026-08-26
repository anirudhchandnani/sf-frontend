import {
  CONTACT_FIELDS,
  MAX_ADDRESSES,
  MAX_PHOTO_BYTES,
  addressListSchema,
  contactInputSchema,
  decodedPhotoBytes,
  formDataToValues,
  zodAddressErrors,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    notes: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), phone: "9".repeat(41) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      phone: "Phone must be 40 characters or fewer",
    });
  });
});

describe("photo size", () => {
  const png = (bytes: number) =>
    `data:image/png;base64,${"A".repeat(Math.ceil((bytes * 4) / 3))}`;

  it("measures decoded bytes, not the encoded string", () => {
    // Base64 inflates by ~4/3, so capping the string length would wrongly
    // reject an image that is comfortably under the limit.
    expect(decodedPhotoBytes("data:image/png;base64,QUJD")).toBe(3);
    expect(decodedPhotoBytes("data:image/png;base64,QQ==")).toBe(1);
    expect(decodedPhotoBytes("data:image/png;base64,QUI=")).toBe(2);
  });

  it("accepts a photo under the limit", () => {
    const result = contactInputSchema.safeParse(values({ photo: png(1000) }));
    expect(result.success).toBe(true);
  });

  it("rejects a photo over the limit", () => {
    // This is the check that used to live only in the browser component, so a
    // post that skipped it reached the API and failed with a generic error.
    const result = contactInputSchema.safeParse(
      values({ photo: png(MAX_PHOTO_BYTES + 1024) }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toMatch(/2 MB/);
  });
});

describe("addressListSchema", () => {
  const address = (overrides: Record<string, string> = {}) => ({
    type: "Home",
    street: "12 Ockham Rd",
    city: "London",
    state: "",
    postal_code: "",
    country: "",
    ...overrides,
  });

  it("accepts a normal list", () => {
    expect(addressListSchema.safeParse([address()]).success).toBe(true);
  });

  it("rejects an address with nothing filled in", () => {
    const result = addressListSchema.safeParse([
      { type: "Home", street: "", city: "", state: "", postal_code: "", country: "" },
    ]);

    expect(result.success).toBe(false);
  });

  it("accepts an address with only one part filled in", () => {
    const result = addressListSchema.safeParse([
      address({ street: "", city: "", country: "UK" }),
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects duplicate rows", () => {
    const result = addressListSchema.safeParse([address(), address()]);

    expect(result.success).toBe(false);
    expect(zodAddressErrors(result.error!)[1]).toMatch(/same as address 1/i);
  });

  it("ignores case and padding when comparing", () => {
    const result = addressListSchema.safeParse([
      address(),
      address({ city: "  LONDON  " }),
    ]);

    expect(result.success).toBe(false);
  });

  it("allows the same address under two different types", () => {
    // Working from home is legitimate.
    const result = addressListSchema.safeParse([
      address({ type: "Home" }),
      address({ type: "Work" }),
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects more addresses than the cap", () => {
    const many = Array.from({ length: MAX_ADDRESSES + 1 }, (_, i) =>
      address({ city: `c${i}` }),
    );

    expect(addressListSchema.safeParse(many).success).toBe(false);
  });

  it("accepts exactly the cap", () => {
    const many = Array.from({ length: MAX_ADDRESSES }, (_, i) =>
      address({ city: `c${i}` }),
    );

    expect(addressListSchema.safeParse(many).success).toBe(true);
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "photo"].sort(),
    );
  });

  it("carries photo through, which CONTACT_FIELDS does not cover", () => {
    // photo comes from PhotoField's hidden input, not from CONTACT_FIELD_GROUPS.
    // Saving is a full replace, so dropping it here would wipe the picture on
    // every edit that only touched a name.
    const formData = new FormData();
    formData.set("photo", "data:image/png;base64,iVBORw0KGgo=");

    expect(formDataToValues(formData).photo).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
  });

  it("returns an empty photo when the form has none", () => {
    expect(formDataToValues(new FormData()).photo).toBe("");
  });
});
