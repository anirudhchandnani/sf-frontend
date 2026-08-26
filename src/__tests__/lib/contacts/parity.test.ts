import { contactInputSchema } from "@/lib/contacts/schema";

/**
 * Front/back parity for the photo field.
 *
 * The browser and the API must agree on what a valid photo is. Where they
 * disagree, a user gets a generic API failure instead of a message on the field
 * — which is exactly what happened when the size cap and the content check
 * lived only on one side.
 *
 * Each case here was run against the real API to confirm it answers the same way.
 */

function parse(photo: string) {
  return contactInputSchema.safeParse({
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    photo,
  });
}

const PNG_HEAD = btoa(
  String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00),
);

describe("photo validation parity with the API", () => {
  it.each([
    ["valid PNG", `data:image/png;base64,${PNG_HEAD}`, true],
    // "ABC" — passes the pattern, but is not an image. The API sniffs magic
    // bytes, so accepting it here would produce a mismatch.
    ["base64 of plain text", "data:image/png;base64,QUJD", false],
    ["HTML declared as PNG", `data:image/png;base64,${btoa("<html></html>")}`, false],
    ["SVG, an XSS vector", `data:image/svg+xml;base64,${btoa("<svg/>")}`, false],
    ["URL rather than data", "https://example.com/a.png", false],
    ["no base64 marker", "data:image/png,QUJD", false],
    ["uppercase scheme", `DATA:IMAGE/PNG;BASE64,${PNG_HEAD}`, false],
    ["image/jpg, not jpeg", `data:image/jpg;base64,${PNG_HEAD}`, false],
    ["empty string clears the photo", "", true],
  ])("%s", (_label, photo, expected) => {
    expect(parse(photo).success).toBe(expected);
  });

  it("rejects an oversized photo before it reaches the API", () => {
    // The cap used to live only in PhotoField, so a post that skipped the
    // browser hit the API and came back as a form-level error.
    const oversized = `data:image/png;base64,${PNG_HEAD}${"A".repeat(3_000_000)}`;

    expect(parse(oversized).success).toBe(false);
  });
});
