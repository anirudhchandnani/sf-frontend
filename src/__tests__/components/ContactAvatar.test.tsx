import { fireEvent, render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

describe("ContactAvatar", () => {
  it("shows initials when the contact has no photo", () => {
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

    expect(container.querySelector("img")).toHaveAttribute("src", PHOTO);
  });

  it("renders the photo as a circle, LinkedIn style", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

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

  it("hides the whole avatar from assistive tech, since the name is shown", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    // The wrapper carries aria-hidden, so both the image and the initials
    // underneath it are skipped rather than announced twice.
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  describe("fallback", () => {
    it("keeps the initials underneath the photo", () => {
      // A transparent PNG is a valid image, so onError never fires — layering
      // the initials behind it is what stops the avatar reading as empty.
      render(<ContactAvatar contact={makeContact({ photo: PHOTO })} />);

      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("reveals the initials when the image fails to decode", () => {
      const { container } = render(
        <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
      );

      fireEvent.error(container.querySelector("img")!);

      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("retries when the source changes", () => {
      const { container, rerender } = render(
        <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
      );
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();

      rerender(
        <ContactAvatar
          contact={makeContact({ photo: "data:image/png;base64,Zm l4ZWQ=" })}
        />,
      );

      expect(container.querySelector("img")).not.toBeNull();
    });
  });

  describe("list items", () => {
    it("fetches the photo by URL when given has_photo instead of bytes", () => {
      // List responses no longer inline base64; they carry a flag.
      const { container } = render(
        <ContactAvatar
          contact={{
            id: 7,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            has_photo: true,
          }}
        />,
      );

      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        "/api/contacts/7/photo",
      );
    });

    it("shows initials when has_photo is false", () => {
      const { container } = render(
        <ContactAvatar
          contact={{
            id: 7,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            has_photo: false,
          }}
        />,
      );

      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByText("AL")).toBeInTheDocument();
    });
  });
});
