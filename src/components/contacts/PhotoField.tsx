"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, ImageUp, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { MAX_PHOTO_BYTES, sniffImageType } from "@/lib/contacts/schema";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Profile picture picker.
 *
 * The chosen file is read into a base64 data URL and parked in a hidden input, so
 * the value travels with the ordinary form POST and needs no client-side fetch.
 * The hidden input is seeded with the contact's current photo, which is what keeps
 * a full-replace PUT from wiping the picture when someone only edits a name.
 *
 * Only this leaf is a client component — the pages that mount it stay server-rendered.
 */
export default function PhotoField({
  defaultValue = null,
  error,
}: {
  defaultValue?: string | null;
  error?: string;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultValue);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const describedBy = `${inputId}-help`;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check before encoding — the same limits the API enforces, so the user gets
    // a message here instead of a 422 after a round trip.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError("Choose a PNG, JPEG, GIF, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setLocalError(`That image is ${mb} MB. The limit is 2 MB.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setLocalError("Could not read that file.");
    reader.onload = () => {
      const dataUrl = String(reader.result);

      // file.type comes from the extension on most platforms, so a renamed
      // text file reports image/png. Check the bytes, as the API does.
      const actual = sniffImageType(dataUrl);
      if (actual === null) {
        setLocalError("That file is not a valid image.");
        event.target.value = "";
        return;
      }
      if (actual !== file.type) {
        setLocalError(`That file is named as ${file.type} but contains ${actual} data.`);
        event.target.value = "";
        return;
      }

      setPhoto(dataUrl);
      setLocalError(null);
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhoto(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const message = localError ?? error;

  return (
    <div className="flex items-center gap-4">
      {/* Carries the value through submit, including when no new file is picked. */}
      <input type="hidden" name="photo" value={photo ?? ""} />

      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL, nothing for next/image to optimise
        <img
          src={photo}
          alt="Profile photo preview"
          className="h-20 w-20 shrink-0 rounded-full object-cover aspect-square ring-1 ring-hairline"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-hairline text-muted-foreground"
        >
          <ImageUp className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className={buttonClasses("secondary")}>
            {photo ? "Change photo" : "Upload photo"}
          </label>
          {photo ? (
            <button
              type="button"
              onClick={clearPhoto}
              className={buttonClasses("secondary")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFile}
          aria-describedby={describedBy}
          className="sr-only"
        />

        {message ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-[13px] text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {message}
          </p>
        ) : (
          <p id={describedBy} className="text-[13px] text-muted-foreground">
            PNG, JPEG, GIF, or WebP. Up to 2 MB. Without one we show their initials.
          </p>
        )}
      </div>
    </div>
  );
}
