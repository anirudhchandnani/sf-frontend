import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

describe("ContactAvatar", () => {
  it("falls back to initials when the contact has no photo", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: null })} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("renders the photo when one is present", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", PHOTO);
    expect(screen.queryByText("AL")).not.toBeInTheDocument();
  });

  it("renders the photo as a circle, LinkedIn style", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    // The three classes that make it read as a profile picture rather than a
    // stretched thumbnail.
    const className = container.querySelector("img")?.className ?? "";
    expect(className).toContain("rounded-full");
    expect(className).toContain("object-cover");
    expect(className).toContain("aspect-square");
  });

  it("keeps the circular shape at every size", () => {
    for (const size of ["sm", "md", "lg", "xl"] as const) {
      const { container } = render(
        <ContactAvatar contact={makeContact({ photo: PHOTO })} size={size} />,
      );
      expect(container.querySelector("img")?.className).toContain(
        "rounded-full",
      );
    }
  });

  it("hides the avatar from assistive tech, since the name is already shown", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
