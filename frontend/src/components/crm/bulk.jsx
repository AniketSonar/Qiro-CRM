import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import { Th, Td } from "./AppShell";
import { Select } from "./form";

/** Row selection for any list. `ids` = the ids currently visible. */
export function useSelection(ids) {
  const [selected, setSelected] = useState([]);

  const key = ids.join("|");
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => ids.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = useCallback((id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.length === ids.length ? [] : [...ids]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clear = useCallback(() => setSelected([]), []);

  return useMemo(
    () => ({
      selected,
      isSelected: (id) => selected.includes(id),
      toggle,
      toggleAll,
      clear,
      allChecked: ids.length > 0 && selected.length === ids.length,
      someChecked: selected.length > 0 && selected.length < ids.length
    }),
    [selected, key, toggle, toggleAll, clear]
  );
}

const box =
  "size-4 cursor-pointer rounded border-border accent-primary align-middle";

export function SelectTh({ checked, indeterminate, onChange }) {
  return (
    <Th className="w-10 pr-0">
      <input
        type="checkbox"
        className={box}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate) && !checked;
        }}
        onChange={onChange}
        aria-label="Select all rows"
      />
    </Th>
  );
}

export function SelectTd({ checked, onChange }) {
  return (
    <Td className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        className={box}
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onChange();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    </Td>
  );
}

/** Sticky action bar: bulk assign the selected rows to a sales person. */
export function BulkBar({ count, users, onAssign, onClear, noun = "record" }) {
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (count === 0) return null;

  const apply = async () => {
    if (!owner) {
      setError("Pick a sales person first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAssign(Number(owner));
      setOwner("");
      onClear();
    } catch (err) {
      setError(err?.message || "Could not reassign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel sticky top-[68px] z-20 flex flex-wrap items-center gap-3 bg-card px-4 py-3">
      <span className="text-sm font-bold">
        {count} {noun}
        {count > 1 ? "s" : ""} selected
      </span>
      <div className="w-[230px] shrink-0">
        <Select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            setError(null);
          }}
        >
          <option value="">Assign to…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role}
            </option>
          ))}
        </Select>
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={busy}
        className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
        Assign
      </button>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" /> Clear
      </button>
      {error ? <span className="text-sm font-semibold text-destructive">{error}</span> : null}
    </div>
  );
}
