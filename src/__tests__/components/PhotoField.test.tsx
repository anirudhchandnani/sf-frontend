import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoField from "@/components/contacts/PhotoField";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

/** The hidden input is what actually travels with the form POST. */
function hiddenPhotoInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[type="hidden"][name="photo"]');
}

function fileOfSize(bytes: number, type = "image/png"): File {
  const file = new File(["x"], "avatar.png", { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

describe("PhotoField", () => {
  it("seeds the hidden input from the existing photo", () => {
    // This is what stops a full-replace PUT from wiping the picture when the
    // user edits a name and never touches the file picker.
    const { container } = render(<PhotoField defaultValue={PHOTO} />);

    expect(hiddenPhotoInput(container)).toHaveValue(PHOTO);
  });

  it("submits an empty photo when the contact has none", () => {
    const { container } = render(<PhotoField defaultValue={null} />);

    expect(hiddenPhotoInput(container)).toHaveValue("");
  });

  it("shows a preview of the existing photo", () => {
    render(<PhotoField defaultValue={PHOTO} />);

    expect(screen.getByAltText(/profile photo preview/i)).toHaveAttribute(
      "src",
      PHOTO,
    );
  });

  it("clears the photo when Remove is clicked", async () => {
    const { container } = render(<PhotoField defaultValue={PHOTO} />);

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(hiddenPhotoInput(container)).toHaveValue("");
    expect(screen.queryByAltText(/profile photo preview/i)).toBeNull();
  });

  it("offers no Remove button when there is no photo", () => {
    render(<PhotoField defaultValue={null} />);

    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  it("rejects a file that is not an accepted image type", async () => {
    const { container } = render(<PhotoField defaultValue={null} />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;

    // applyAccept:false bypasses the `accept` attribute, the way a user picking
    // "All files" in the OS dialog does. The component must still reject it.
    await userEvent.upload(input, fileOfSize(1024, "application/pdf"), {
      applyAccept: false,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /PNG, JPEG, GIF, or WebP/i,
    );
    expect(hiddenPhotoInput(container)).toHaveValue("");
  });

  it("rejects an image over the 2 MB limit", async () => {
    const { container } = render(<PhotoField defaultValue={null} />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;

    await userEvent.upload(input, fileOfSize(3 * 1024 * 1024));

    expect(await screen.findByRole("alert")).toHaveTextContent(/2 MB/i);
    expect(hiddenPhotoInput(container)).toHaveValue("");
  });

  it("surfaces a server-side error message", () => {
    render(<PhotoField defaultValue={null} error="Unsupported image type" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported image type",
    );
  });

  describe("file type matrix", () => {
    function fileInput(container: HTMLElement) {
      return container.querySelector<HTMLInputElement>('input[type="file"]')!;
    }

    it.each(["image/png", "image/jpeg", "image/gif", "image/webp"])(
      "accepts %s",
      async (type) => {
        const { container } = render(<PhotoField defaultValue={null} />);

        await userEvent.upload(container.querySelector('input[type="file"]')!, fileOfSize(1024, type), {
          applyAccept: false,
        });

        expect(screen.queryByRole("alert")).toBeNull();
      },
    );

    it.each([
      ["image/svg+xml", "SVG can carry script tags"],
      ["image/bmp", "outside the allow-list"],
      ["image/tiff", "outside the allow-list"],
      ["application/pdf", "not an image"],
      ["text/html", "renders as markup"],
      ["video/mp4", "not an image"],
      ["", "browser could not determine a type"],
    ])("rejects %s (%s)", async (type) => {
      const { container } = render(<PhotoField defaultValue={null} />);

      await userEvent.upload(fileInput(container), fileOfSize(1024, type), {
        applyAccept: false,
      });

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(hiddenPhotoInput(container)).toHaveValue("");
    });

    it("advertises only the accepted types to the file dialog", () => {
      const { container } = render(<PhotoField defaultValue={null} />);

      expect(fileInput(container).accept).toBe(
        "image/png,image/jpeg,image/gif,image/webp",
      );
    });

    it("accepts a file at exactly the 2 MB limit", async () => {
      const { container } = render(<PhotoField defaultValue={null} />);

      await userEvent.upload(fileInput(container), fileOfSize(2 * 1024 * 1024));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("rejects a file one byte over the limit", async () => {
      const { container } = render(<PhotoField defaultValue={null} />);

      await userEvent.upload(
        fileInput(container),
        fileOfSize(2 * 1024 * 1024 + 1),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(/2 MB/i);
    });

    it("keeps the previous photo when a new pick is rejected", async () => {
      // A bad second choice must not silently clear a good first one.
      const { container } = render(<PhotoField defaultValue={PHOTO} />);

      await userEvent.upload(fileInput(container), fileOfSize(1024, "application/pdf"), {
        applyAccept: false,
      });

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(hiddenPhotoInput(container)).toHaveValue(PHOTO);
    });

    it("clears the error once a valid file is chosen", async () => {
      const { container } = render(<PhotoField defaultValue={null} />);

      await userEvent.upload(fileInput(container), fileOfSize(3 * 1024 * 1024));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await userEvent.upload(fileInput(container), fileOfSize(1024));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });
});
