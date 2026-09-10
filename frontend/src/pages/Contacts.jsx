import { useMemo, useState } from "react";
import { Mail, Phone, Plus } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, initialsOf } from "../components/crm/ui-bits";
import {
  ConfirmModal,
  Field,
  FormModal,
  Input,
  RowMenu,
  SearchField,
  Select,
  Textarea,
  formValues
} from "../components/crm/form";
import { crud, useContacts, useLookups } from "../lib/crm-store";

function ContactForm({ open, mode, contact, users, onClose }) {
  const raw = contact?.raw ?? {};

  const submit = async (fd) => {
    const body = formValues(fd);
    if (body.owner_id) body.owner_id = Number(body.owner_id);
    if (mode === "edit") await crud.contacts.update(contact.id, body);
    else await crud.contacts.create(body);
  };

  return (
    <FormModal
      key={`${mode}-${contact?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit contact" : "Add contact"}
      description="People you talk to, mapped to their company."
      submitLabel={mode === "edit" ? "Save changes" : "Create contact"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input name="first_name" defaultValue={raw.first_name ?? ""} required autoFocus />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={raw.last_name ?? ""} />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" defaultValue={raw.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={raw.phone ?? ""} />
        </Field>
        <Field label="Company">
          <Input name="company" defaultValue={raw.company ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={raw.city ?? ""} />
        </Field>
        <Field label="State">
          <Input name="state" defaultValue={raw.state ?? ""} />
        </Field>
        <Field label="Country">
          <Input name="country" defaultValue={raw.country ?? ""} />
        </Field>
        <Field label="Assigned to">
          <Select name="owner_id" defaultValue={raw.owner_id ?? ""}>
            <option value="">Me</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input name="address" defaultValue={raw.address ?? ""} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={raw.notes ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

export default function Contacts() {
  const { data: contacts, loading } = useContacts();
  const { users } = useLookups();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.company, c.email, c.phone, c.title].join(" ").toLowerCase().includes(q)
    );
  }, [contacts, query]);

  return (
    <AppShell
      title="Contacts"
      subtitle={`${contacts.length} people across ${new Set(contacts.map((c) => c.company)).size} companies`}
      actions={
        <>
          <GhostButton onClick={() => setQuery("")}>Clear filters</GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Add contact
          </button>
        </>
      }
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search contacts…"
        className="max-w-sm"
      />

      {rows.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-sm text-muted-foreground">
            {loading ? "Loading contacts…" : "No contacts yet — add your first one."}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Panel key={c.id} className="transition-transform hover:-translate-y-0.5 hover:shadow-float">
              <div className="flex items-start gap-3">
                <Avatar initials={initialsOf(c.name)} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.title}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-primary">{c.company}</p>
                </div>
                <RowMenu
                  items={[
                    { label: "Edit contact", onSelect: () => setForm({ mode: "edit", contact: c }) },
                    { label: "Delete contact", danger: true, onSelect: () => setRemove(c) }
                  ]}
                />
              </div>

              <Chip tone="info" className="mt-4">
                {c.type}
              </Chip>

              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{c.email}</span>
                </p>
                <p className="numeric flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" />
                  {c.phone}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <ContactForm
        open={Boolean(form)}
        mode={form?.mode}
        contact={form?.contact}
        users={users}
        onClose={() => setForm(null)}
      />
      <ConfirmModal
        open={Boolean(remove)}
        title="Delete contact"
        message={remove ? `${remove.name} will be removed permanently.` : ""}
        onClose={() => setRemove(null)}
        onConfirm={() => crud.contacts.remove(remove.id)}
      />
    </AppShell>
  );
}
