import { useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, initialsOf, statusTone } from "../components/crm/ui-bits";
import {
  ConfirmModal,
  EmptyRow,
  Field,
  FormModal,
  Input,
  RowMenu,
  SearchField,
  Select,
  formValues
} from "../components/crm/form";
import { crud, useLookups, useUsers } from "../lib/crm-store";

const permissions = [
  { role: "Admin", scope: "Everything, including users and settings" },
  { role: "Sales Person", scope: "Own leads, deals, follow-ups and customers" },
  { role: "Customer", scope: "Own profile and shared documents" }
];

function UserForm({ open, mode, user, roles, onClose }) {
  const raw = user?.raw ?? {};
  const submit = async (fd) => {
    const body = formValues(fd);
    if (mode === "edit") {
      const { role, ...rest } = body;
      await crud.users.update(user.id, rest);
      if (role && role !== String(raw.role).toUpperCase()) await crud.users.setRole(user.id, role);
    } else {
      await crud.users.create(body);
    }
  };

  return (
    <FormModal
      key={`${mode}-${user?.id ?? "new"}-${open}`}
      open={open}
      title={mode === "edit" ? "Edit teammate" : "Invite teammate"}
      description="Roles are enforced server side on every request."
      submitLabel={mode === "edit" ? "Save changes" : "Create user"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2">
          <Input name="name" defaultValue={raw.name ?? ""} required autoFocus />
        </Field>
        <Field label="Email" required className="sm:col-span-2">
          <Input type="email" name="email" defaultValue={raw.email ?? ""} required />
        </Field>
        {mode === "edit" ? null : (
          <Field label="Temporary password" required className="sm:col-span-2">
            <Input type="password" name="password" required minLength={6} />
          </Field>
        )}
        <Field label="Role" required>
          <Select name="role" defaultValue={String(raw.role ?? roles[0]?.name ?? "").toUpperCase()}>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={raw.phone ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

export default function Users() {
  const { data: users, loading } = useUsers();
  const { roles } = useLookups();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.role].join(" ").toLowerCase().includes(q));
  }, [users, query]);

  return (
    <AppShell
      title="Users & roles"
      subtitle={`${users.length} seats used · role-based access enforced server side`}
      actions={
        <>
          <GhostButton onClick={() => setQuery("")}>Clear search</GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Invite teammate
          </button>
        </>
      }
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search teammates…" className="max-w-sm" />

      <TableShell>
        <thead>
          <tr>
            <Th>Teammate</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Last active</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} message={loading ? "Loading users…" : "No teammates found"} />
          ) : (
            rows.map((u) => {
              const active = String(u.raw?.status ?? "ACTIVE").toUpperCase() === "ACTIVE";
              return (
                <tr key={u.id} className="transition-colors hover:bg-muted/50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials={initialsOf(u.name)} />
                      <span className="font-semibold">{u.name}</span>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>
                    <Select
                      className="h-8 w-[150px] text-xs font-semibold"
                      value={String(u.raw?.role ?? "").toUpperCase()}
                      onChange={(e) => crud.users.setRole(u.id, e.target.value)}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Chip tone={statusTone(u.status)} dot>
                      {u.status}
                    </Chip>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{u.lastSeen}</Td>
                  <Td className="text-right">
                    <RowMenu
                      items={[
                        { label: "Edit teammate", onSelect: () => setForm({ mode: "edit", user: u }) },
                        {
                          label: active ? "Deactivate" : "Activate",
                          onSelect: () => crud.users.setStatus(u.id, active ? "INACTIVE" : "ACTIVE")
                        },
                        { label: "Delete user", danger: true, onSelect: () => setRemove(u) }
                      ]}
                    />
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>

      <Panel title="Role permissions" description="What each role can reach">
        <ul className="divide-y divide-border">
          {permissions.map((p) => (
            <li key={p.role} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <span className="w-36 shrink-0 text-sm font-bold">{p.role}</span>
              <span className="text-sm text-muted-foreground">{p.scope}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <UserForm
        open={Boolean(form)}
        mode={form?.mode}
        user={form?.user}
        roles={roles}
        onClose={() => setForm(null)}
      />
      <ConfirmModal
        open={Boolean(remove)}
        title="Delete user"
        message={remove ? `${remove.name} will lose access immediately.` : ""}
        onClose={() => setRemove(null)}
        onConfirm={() => crud.users.remove(remove.id)}
      />
    </AppShell>
  );
}
