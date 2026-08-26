import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressListField from "@/components/contacts/AddressListField";
import { formDataToAddresses } from "@/lib/contacts/schema";
import type { Address, AddressInput } from "@/lib/contacts/types";

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 1,
    contact_id: 1,
    type: "Home",
    street: "12 Ockham Rd",
    city: "London",
    state: null,
    postal_code: "SW1A 1AA",
    country: "UK",
    ...overrides,
  };
}

/** Render inside a form so the inputs are reachable through FormData. */
function renderInForm(defaultValue: AddressInput[] = []) {
  const result = render(
    <form data-testid="form">
      <AddressListField defaultValue={defaultValue} />
    </form>,
  );
  const form = result.getByTestId("form") as HTMLFormElement;
  return { ...result, form, read: () => formDataToAddresses(new FormData(form)) };
}

describe("AddressListField", () => {
  it("shows an empty state when there are no addresses", () => {
    renderInForm();

    expect(screen.getByText(/no addresses yet/i)).toBeInTheDocument();
  });

  it("renders one row per address", () => {
    renderInForm([
      makeAddress({ id: 1, type: "Home" }),
      makeAddress({ id: 2, type: "Work", street: "1 Market St" }),
    ]);

    expect(screen.getByLabelText("Address 1 type")).toHaveValue("Home");
    expect(screen.getByLabelText("Address 2 type")).toHaveValue("Work");
    expect(screen.queryByText(/no addresses yet/i)).toBeNull();
  });

  it("offers exactly Home, Work, and Other", () => {
    renderInForm([makeAddress()]);

    const options = screen
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).toEqual(["Home", "Work", "Other"]);
  });

  it("adds a row on demand, defaulting to Home", async () => {
    const { read } = renderInForm();

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));

    expect(read()).toEqual([
      {
        type: "Home",
        street: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
      },
    ]);
  });

  it("removes the right row, not just the last one", async () => {
    // The regression an index-keyed list produces: removing the middle row
    // drops the wrong data because React reuses inputs by position.
    const { read } = renderInForm([
      makeAddress({ id: 1, type: "Home", street: "First" }),
      makeAddress({ id: 2, type: "Work", street: "Second" }),
      makeAddress({ id: 3, type: "Other", street: "Third" }),
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: /remove address 2/i }),
    );

    const rows = read() as Array<Record<string, string>>;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.street)).toEqual(["First", "Third"]);
    expect(rows.map((row) => row.type)).toEqual(["Home", "Other"]);
  });

  it("renumbers input names after a removal so no index is skipped", async () => {
    const { form } = renderInForm([
      makeAddress({ id: 1, street: "First" }),
      makeAddress({ id: 2, street: "Second" }),
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: /remove address 1/i }),
    );

    const names = [...new FormData(form).keys()].filter((key) =>
      key.startsWith("addresses"),
    );
    expect(names.every((name) => name.startsWith("addresses[0]"))).toBe(true);
  });

  it("keeps every row in FormData, not just the first", async () => {
    const { read } = renderInForm([
      makeAddress({ id: 1, type: "Home", city: "London" }),
      makeAddress({ id: 2, type: "Work", city: "San Francisco" }),
      makeAddress({ id: 3, type: "Other", city: "Sonoma" }),
    ]);

    const rows = read() as Array<Record<string, string>>;
    expect(rows.map((row) => row.city)).toEqual([
      "London",
      "San Francisco",
      "Sonoma",
    ]);
  });

  it("round-trips an edited value", async () => {
    const { read } = renderInForm([makeAddress({ street: "Old" })]);

    const input = screen.getByDisplayValue("Old");
    await userEvent.clear(input);
    await userEvent.type(input, "New");

    expect((read()[0] as Record<string, string>).street).toBe("New");
  });

  it("round-trips a changed type", async () => {
    const { read } = renderInForm([makeAddress({ type: "Home" })]);

    await userEvent.selectOptions(
      screen.getByLabelText("Address 1 type"),
      "Other",
    );

    expect((read()[0] as Record<string, string>).type).toBe("Other");
  });

  it("renders a null part as an empty input", () => {
    renderInForm([makeAddress({ state: null })]);

    // Not the string "null".
    expect(screen.queryByDisplayValue("null")).toBeNull();
  });

  it("shows a per-row error", () => {
    render(
      <AddressListField
        defaultValue={[makeAddress(), makeAddress({ id: 2 })]}
        errors={{ 1: "postal_code: too long" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("postal_code: too long");
  });
});

describe("formDataToAddresses", () => {
  it("returns nothing when the form has no address rows", () => {
    const formData = new FormData();
    formData.set("first_name", "Ada");

    expect(formDataToAddresses(formData)).toEqual([]);
  });

  it("ignores keys that are not address rows", () => {
    const formData = new FormData();
    formData.set("addresses", "nope");
    formData.set("addressesFoo", "nope");
    formData.set("addresses[0][city]", "London");

    expect(formDataToAddresses(formData)).toEqual([{ city: "London" }]);
  });

  it("sorts indices numerically, not as strings", () => {
    // "10" sorts before "2" alphabetically; the order must follow the numbers.
    const formData = new FormData();
    formData.set("addresses[2][city]", "second");
    formData.set("addresses[10][city]", "third");
    formData.set("addresses[1][city]", "first");

    expect(formDataToAddresses(formData)).toEqual([
      { city: "first" },
      { city: "second" },
      { city: "third" },
    ]);
  });
});
