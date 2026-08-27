import {
  addressLine,
  avatarHue,
  formatTimestamp,
  groupAddressesByType,
  initials,
  jobLine,
} from "@/lib/contacts/format";
import type { Address } from "@/lib/contacts/types";
import { makeContact } from "../../mocks/handlers";

describe("initials", () => {
  it("takes the first letter of each name", () => {
    expect(initials({ first_name: "ada", last_name: "lovelace" })).toBe("AL");
  });

  it("survives an emoji name without emitting half a surrogate pair", () => {
    // `.at(0)` would return a lone high surrogate here and render as U+FFFD.
    expect(initials({ first_name: "🎉", last_name: "Party" })).toBe("🎉P");
  });

  it("keeps a ZWJ emoji sequence intact", () => {
    expect(initials({ first_name: "👨‍👩‍👧", last_name: "Family" })).toBe(
      "👨‍👩‍👧F",
    );
  });

  it("handles astral-plane letters", () => {
    expect(initials({ first_name: "𝒜da", last_name: "𝔏ovelace" })).toBe("𝒜𝔏");
  });

  it("handles non-Latin scripts", () => {
    expect(initials({ first_name: "Ада", last_name: "Лавлейс" })).toBe("АЛ");
    expect(initials({ first_name: "愛", last_name: "田" })).toBe("愛田");
    expect(initials({ first_name: "أحمد", last_name: "علي" })).toBe("أع");
  });

  it("keeps a combining accent attached to its base letter", () => {
    expect(initials({ first_name: "é", last_name: "Smith" })).toBe("ÉS");
  });

  it("ignores leading and trailing whitespace", () => {
    expect(initials({ first_name: "  ada  ", last_name: "  lovelace " })).toBe(
      "AL",
    );
  });

  it("returns what it can when a name is blank", () => {
    expect(initials({ first_name: "Ada", last_name: "" })).toBe("A");
    expect(initials({ first_name: "", last_name: "Lovelace" })).toBe("L");
    expect(initials({ first_name: "", last_name: "" })).toBe("");
    expect(initials({ first_name: "   ", last_name: "   " })).toBe("");
  });

  it("never returns more than two graphemes", () => {
    const result = initials({
      first_name: "Christopher",
      last_name: "Wallace-Smith",
    });
    expect(Array.from(result)).toHaveLength(2);
  });
});

describe("avatarHue", () => {
  it("is stable for the same seed and within the hue range", () => {
    expect(avatarHue("ada@example.com")).toBe(avatarHue("ada@example.com"));
    expect(avatarHue("ada@example.com")).toBeGreaterThanOrEqual(0);
    expect(avatarHue("ada@example.com")).toBeLessThan(360);
  });

  it("separates different seeds", () => {
    expect(avatarHue("ada@example.com")).not.toBe(avatarHue("grace@example.com"));
  });
});

describe("formatTimestamp", () => {
  it("renders UTC regardless of the machine's zone", () => {
    expect(formatTimestamp("2026-08-19T17:04:53.743932Z")).toBe(
      "19 Aug 2026, 17:04 UTC",
    );
  });

  it("degrades to a dash on garbage input", () => {
    expect(formatTimestamp("not a date")).toBe("—");
  });
});

describe("jobLine", () => {
  it("joins the title and the company", () => {
    expect(jobLine(makeContact())).toBe("Mathematician at Analytical Engines");
  });

  it("falls back to whichever one is set", () => {
    expect(jobLine(makeContact({ company: null }))).toBe("Mathematician");
    expect(jobLine(makeContact({ job_title: null }))).toBe("Analytical Engines");
    expect(jobLine(makeContact({ job_title: null, company: null }))).toBeNull();
  });
});

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 1,
    contact_id: 1,
    type: "Home",
    street: null,
    city: "San Francisco",
    state: "CA",
    postal_code: null,
    country: "USA",
    ...overrides,
  };
}

describe("addressLine", () => {
  it("skips the parts that are not filled in", () => {
    expect(addressLine(makeAddress())).toBe("San Francisco, CA, USA");
  });

  it("pairs the state with the postal code", () => {
    expect(
      addressLine(makeAddress({ street: "1 Market St", postal_code: "94105" })),
    ).toBe("1 Market St, San Francisco, CA 94105, USA");
  });

  it("returns null when there is no address at all", () => {
    expect(
      addressLine(
        makeAddress({ city: null, state: null, country: null, postal_code: null }),
      ),
    ).toBeNull();
  });
});

describe("groupAddressesByType", () => {
  it("orders groups Home, Work, Other regardless of input order", () => {
    const groups = groupAddressesByType([
      makeAddress({ id: 1, type: "Other" }),
      makeAddress({ id: 2, type: "Work" }),
      makeAddress({ id: 3, type: "Home" }),
    ]);

    expect(groups.map((group) => group.type)).toEqual(["Home", "Work", "Other"]);
  });

  it("omits types the contact has none of", () => {
    const groups = groupAddressesByType([makeAddress({ type: "Work" })]);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("Work");
  });

  it("keeps several addresses of the same type together", () => {
    const groups = groupAddressesByType([
      makeAddress({ id: 1, type: "Home", city: "London" }),
      makeAddress({ id: 2, type: "Home", city: "Bath" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].addresses.map((a) => a.city)).toEqual(["London", "Bath"]);
  });

  it("returns nothing for a contact with no addresses", () => {
    expect(groupAddressesByType([])).toEqual([]);
  });
});
