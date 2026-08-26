"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, MapPin, Plus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { ADDRESS_TYPES, type AddressInput } from "@/lib/contacts/types";

/** A row plus a stable key, so React keeps inputs attached across reorders. */
type Row = AddressInput & { key: string };

const EMPTY: AddressInput = {
  type: "Home",
  street: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
};

const PARTS = [
  { name: "street", label: "Street address", placeholder: "1 Market St, Suite 400", wide: true, autoComplete: "street-address", maxLength: 300 },
  { name: "city", label: "City", placeholder: "San Francisco", autoComplete: "address-level2", maxLength: 120 },
  { name: "state", label: "State / region", placeholder: "CA", autoComplete: "address-level1", maxLength: 120 },
  { name: "postal_code", label: "Postal code", placeholder: "94105", autoComplete: "postal-code", maxLength: 20 },
  { name: "country", label: "Country", placeholder: "USA", autoComplete: "country-name", maxLength: 120 },
] as const;

/**
 * Keys for rows present on first render.
 *
 * Deterministic on purpose: a module-level counter would advance on the server
 * and again on the client, so the two renders produced different `htmlFor`
 * values and React reported a hydration mismatch. Rows added later get their
 * keys from a ref, which only ever runs in a browser event handler.
 */
const initialKey = (index: number) => `initial-${index}`;

/**
 * Repeatable address rows.
 *
 * Inputs are named `addresses[i][field]` because `FormData` is flat and a
 * repeated plain name would collapse to its first value on the server. The
 * index is positional only — it is re-derived from array order on every render,
 * so removing a middle row renumbers the rest rather than leaving a hole.
 */
export default function AddressListField({
  defaultValue = [],
  errors,
}: {
  defaultValue?: AddressInput[];
  errors?: Record<number, string>;
}) {
  const baseId = useId();
  const addedCount = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    defaultValue.map((address, index) => ({ ...address, key: initialKey(index) })),
  );

  function addRow() {
    const key = `added-${addedCount.current++}`;
    setRows((current) => [...current, { ...EMPTY, key }]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function updateRow(key: string, patch: Partial<AddressInput>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hairline px-4 py-8 text-center">
          <MapPin
            className="h-5 w-5 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-[13px] text-muted-foreground">
            No addresses yet. Add a home, work, or other address.
          </p>
        </div>
      ) : null}

      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          className="space-y-3 rounded-md border border-hairline p-4"
        >
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="sr-only">Address {index + 1} type</span>
              <select
                name={`addresses[${index}][type]`}
                value={row.type}
                onChange={(event) =>
                  updateRow(row.key, {
                    type: event.target.value as AddressInput["type"],
                  })
                }
                aria-label={`Address ${index + 1} type`}
                className="rounded-md border border-hairline bg-background px-2 py-1 text-[13px] text-foreground"
              >
                {ADDRESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove address ${index + 1}`}
              className={buttonClasses("secondary")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PARTS.map((part) => (
              <div
                key={part.name}
                className={"wide" in part && part.wide ? "sm:col-span-2" : undefined}
              >
                <label
                  htmlFor={`${baseId}-${index}-${part.name}`}
                  className="mb-1 block text-[13px] font-medium text-foreground"
                >
                  {part.label}
                </label>
                <input
                  id={`${baseId}-${index}-${part.name}`}
                  name={`addresses[${index}][${part.name}]`}
                  value={row[part.name] ?? ""}
                  onChange={(event) =>
                    updateRow(row.key, { [part.name]: event.target.value })
                  }
                  placeholder={part.placeholder}
                  autoComplete={part.autoComplete}
                  maxLength={part.maxLength}
                  className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            ))}
          </div>

          {errors?.[index] ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-[13px] text-destructive"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errors[index]}
            </p>
          ) : null}
        </fieldset>
      ))}

      <button type="button" onClick={addRow} className={buttonClasses("secondary")}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add address
      </button>
    </div>
  );
}
