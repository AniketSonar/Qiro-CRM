import { useEffect, useRef, useState } from "react";
import { X, Loader2, MoreHorizontal, Search } from "lucide-react";

/* ---------- primitives ---------- */

const baseField =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/25";

export function Input({ className = "", ...props }) {
  return <input className={`${baseField} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${baseField} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`${baseField} h-auto min-h-[84px] py-2.5 leading-relaxed ${className}`}
      {...props}
    />
  );
}

export function Field({ label, required, hint, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function PrimaryButton({ className = "", busy, children, ...props }) {
  return (
    <button
      className={`brand-surface inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function SubtleButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- modal ---------- */

export function Modal({ open, title, description, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={`panel my-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"} bg-card p-0 shadow-float`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Modal wrapping a form with submit handling, busy state and error banner. */
export function FormModal({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel = "Save",
  children,
  wide
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handle = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(new FormData(event.currentTarget));
      onClose?.();
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={title} description={description} onClose={onClose} wide={wide}>
      <form onSubmit={handle} className="space-y-5">
        {error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        {children}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <SubtleButton type="button" onClick={onClose}>
            Cancel
          </SubtleButton>
          <PrimaryButton type="submit" busy={busy}>
            {submitLabel}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = "Delete", onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not complete that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <SubtleButton type="button" onClick={onClose}>
            Cancel
          </SubtleButton>
          <PrimaryButton type="button" busy={busy} onClick={go}>
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
    </Modal>
  );
}

/* ---------- row actions ---------- */

export function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Row actions"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div className="panel absolute right-0 z-30 mt-1 w-48 overflow-hidden bg-card p-1 text-left shadow-float">
          {items
            .filter(Boolean)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted ${
                  item.danger ? "text-destructive" : "text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${baseField} pl-9`}
      />
    </div>
  );
}

export function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={
            opt === value
              ? "brand-surface h-9 rounded-full px-4 text-xs font-bold text-primary-foreground"
              : "h-9 rounded-full border border-border bg-card px-4 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function EmptyRow({ colSpan, message = "Nothing here yet" }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

/** value for <input type="datetime-local"> from an ISO string */
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

export const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : "");

/** FormData -> plain object, dropping empty strings */
export const formValues = (fd) => {
  const out = {};
  fd.forEach((value, key) => {
    const v = typeof value === "string" ? value.trim() : value;
    if (v !== "") out[key] = v;
  });
  return out;
};
