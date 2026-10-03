import { useState } from "react";
import { Field, FormModal, Input } from "./form";
import { currency } from "../../lib/crm-data";

const PRESETS = [30, 50, 70, 100];

/** Asks what share of the quotation the proforma should bill, then calls onConfirm(percent). */
export default function ProformaModal({ quotation, onClose, onConfirm }) {
  const [percent, setPercent] = useState(50);
  const total = Number(quotation?.total_amount || 0);
  const pct = Math.min(Math.max(Number(percent) || 0, 0), 100);
  const payable = (total * pct) / 100;

  const submit = async () => {
    if (!(pct > 0)) throw new Error("Enter a percentage between 1 and 100");
    await onConfirm(pct);
  };

  return (
    <FormModal
      key={quotation?.id ?? "none"}
      open={Boolean(quotation)}
      title="Proforma invoice"
      description={quotation ? `Quotation #${quotation.quotation_number}` : ""}
      submitLabel="Download proforma"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                pct === p ? "brand-surface border-transparent text-primary-foreground" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
        <Field label="Custom percentage (%)" hint="Share of the quotation total this proforma bills for">
          <Input type="number" min="1" max="100" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        <div className="space-y-1 rounded-lg border border-border bg-muted/10 p-3 text-xs">
          <div className="flex justify-between text-muted-foreground"><span>Quotation total:</span><span>{currency(total)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
            <span>Amount payable ({pct}%):</span><span>{currency(payable)}</span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
