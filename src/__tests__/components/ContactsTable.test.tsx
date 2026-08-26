import React from "react";
import { render, screen, within } from "@testing-library/react";
import ContactsTable from "@/components/contacts/ContactsTable";
import Pagination from "@/components/contacts/Pagination";
import EmptyState from "@/components/contacts/EmptyState";
import { DEFAULT_LIST_QUERY } from "@/lib/contacts/query";
import { LIST_CONTACTS } from "../mocks/handlers";

jest.mock("@/app/contacts/actions", () => ({
  deleteContactAction: jest.fn(async () => ({})),
}));

describe("ContactsTable", () => {
  it("renders a row per contact with links to view, mail, and edit", () => {
    render(<ContactsTable contacts={LIST_CONTACTS} query={DEFAULT_LIST_QUERY} />);

    expect(screen.getAllByRole("row")).toHaveLength(LIST_CONTACTS.length + 1);

    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/contacts/1",
    );
    expect(
      screen.getByRole("link", { name: "ada@example.com" }),
    ).toHaveAttribute("href", "mailto:ada@example.com");
    expect(
      screen.getByRole("link", { name: /edit ada lovelace/i }),
    ).toHaveAttribute("href", "/contacts/1/edit");
    expect(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    ).toBeInTheDocument();
  });

  it("marks the sorted column and links to the opposite direction", () => {
    render(<ContactsTable contacts={LIST_CONTACTS} query={DEFAULT_LIST_QUERY} />);

    const nameHeader = screen.getByRole("columnheader", { name: /name/i });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(within(nameHeader).getByRole("link")).toHaveAttribute(
      "href",
      "/contacts?order=desc",
    );

    const emailHeader = screen.getByRole("columnheader", { name: /email/i });
    expect(emailHeader).toHaveAttribute("aria-sort", "none");
    expect(within(emailHeader).getByRole("link")).toHaveAttribute(
      "href",
      "/contacts?sort=email",
    );
  });

  it("shows a dash where an optional field is empty", () => {
    render(
      <ContactsTable
        contacts={[{ ...LIST_CONTACTS[0], phone: null, company: null }]}
        query={DEFAULT_LIST_QUERY}
      />,
    );

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("Pagination", () => {
  it("reports the visible range and disables Previous on page one", () => {
    render(<Pagination query={DEFAULT_LIST_QUERY} total={60} shown={25} />);

    expect(screen.getByText(/showing/i)).toHaveTextContent("Showing 1–25 of 60");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /previous/i })).toBeNull();
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute(
      "href",
      "/contacts?page=2",
    );
  });

  it("offers both directions in the middle of the list", () => {
    render(
      <Pagination
        query={{ ...DEFAULT_LIST_QUERY, page: 2 }}
        total={60}
        shown={25}
      />,
    );

    expect(screen.getByText(/showing/i)).toHaveTextContent("Showing 26–50 of 60");
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute(
      "href",
      "/contacts?page=3",
    );
  });
});

describe("EmptyState", () => {
  it("invites the first contact when the address book is empty", () => {
    render(<EmptyState clearHref="/contacts" />);

    expect(
      screen.getByRole("heading", { name: /no contacts yet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /clear search/i })).toBeNull();
  });

  it("offers to clear the filter when a search found nothing", () => {
    render(<EmptyState searchTerm="zzz" clearHref="/contacts" />);

    expect(
      screen.getByRole("heading", { name: /no matching contacts/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clear search/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});
