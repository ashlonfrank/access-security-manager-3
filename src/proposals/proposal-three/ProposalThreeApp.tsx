import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import assets from "../../assets.json";
import initialUsers from "../../users.json";
import legacyRoles from "../../legacy-user-roles.json";
import Avatar from "../../Avatar";
import Modal from "../../Modal";
import RoleSelect from "../../RoleSelect";
import { normalizeDemoPersonas } from "../../demoPersonas";
import { ensureDefaultPendingApproval } from "../../pendingApprovals";
import {
  businessRoles,
  coffeeCompanies,
  companyIndex,
  normalizeRole,
  roleDescriptions,
  statusClass,
} from "../../business";
import {
  formatAccountLabel,
  seedAccountAccess,
  visibleAccountsForUser,
  type AccountProduct,
  type DemoCompanyAccount,
} from "../../demoAccounts";
import {
  paymentTypes,
  permissionsStorageKey,
  readStoredPermissions,
  seedPermissionsForUser,
  statementTypes,
  type Permissions,
} from "../../userPermissions";
import type { User } from "../../App";
import "./proposal-three.css";

const storageKey = "asm-demo-users-v1";
const adminRoles = new Set(["Admin", "Business Partner", "CFO"]);

function Icon({ src, inverse = false }: { src: string; inverse?: boolean }) {
  return inverse ? (
    <span className="masked-icon" style={{ maskImage: `url(${src})` }} aria-hidden="true" />
  ) : (
    <img src={src} alt="" />
  );
}

function Chevron({ size = 16, direction = "right" }: { size?: 12 | 16; direction?: "right" | "down" }) {
  const d = direction === "down" ? "M3.5 6 8 10.5 12.5 6" : "M6 3.5 10.5 8 6 12.5";
  return (
    <svg className="p3-chevron" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normalizeDemoUsers(users: User[]): User[] {
  return normalizeDemoPersonas(
    users.map((user) => {
      const legacy = legacyRoles[user.id as keyof typeof legacyRoles];
      const current = initialUsers.find((row) => row.id === user.id);
      const refreshed = current ? { ...user, avatar: current.avatar } : user;
      const updated =
        legacy && current && user.role === legacy.role && user.job === legacy.job
          ? { ...refreshed, role: current.role, job: current.job }
          : refreshed;
      return { ...updated, role: normalizeRole(updated.role) };
    }),
  );
}

function readUsers(): User[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      Array.isArray(saved) &&
      saved.every(
        (user) =>
          user &&
          ["id", "name", "email", "role", "job", "status"].every((key) => typeof user[key] === "string") &&
          (user.avatar === null ||
            initialUsers.some((row) => row.avatar === user.avatar) ||
            /^\/assets\/imgJp[1-9]\.png$/.test(user.avatar)),
      )
    ) {
      return ensureDefaultPendingApproval(normalizeDemoUsers(saved));
    }
  } catch {
    /* Use the shared roster when storage is unavailable. */
  }
  return ensureDefaultPendingApproval(normalizeDemoUsers(initialUsers));
}

function companiesFor(user: User): number[] {
  if (adminRoles.has(user.role)) return coffeeCompanies.map((_, index) => index);
  return [companyIndex(user.id)];
}

function money(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function withToken(value: Permissions): Permissions {
  return value.mfa
    ? { ...value, token: value.token === "Hard token" ? "Hard token" : "Soft token" }
    : { ...value, mfa: false, token: "No token" };
}

function sectionsFor(product: AccountProduct): { title: string; names: string[] }[] {
  if (product === "credit_card") {
    return [
      { title: "Statements and documents", names: ["See activity and balances"] },
      { title: "Credit cards", names: ["Card access"] },
    ];
  }
  if (product === "merchant_services") {
    return [{ title: "Merchant services", names: ["Merchant services"] }];
  }
  if (product === "payroll") {
    return [
      {
        title: "Money movement",
        names: ["ACH payments", "ACH vendor payments", "Transfers and payments"],
      },
    ];
  }
  return [
    { title: "Statements and documents", names: [...statementTypes] },
    { title: "Money movement", names: [...paymentTypes, "Requires approval"] },
  ];
}

function SolidSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((option) => option.id === value) ?? options[0];
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div className="p3-solid" ref={root}>
      <span id={id}>{label}</span>
      <button
        type="button"
        className="p3-solid-trigger"
        aria-labelledby={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        <span>{current?.label ?? "No accounts"}</span>
        <Chevron direction="down" />
      </button>
      {open && (
        <div className="p3-solid-menu" role="listbox" aria-labelledby={id}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.id === current?.id}
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProposalThreeApp() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>(readUsers);
  const [tab, setTab] = useState<"users" | "companies">("users");
  const [query, setQuery] = useState("");
  const [sortName, setSortName] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [editingUser, setEditingUser] = useState(false);
  const [editingRights, setEditingRights] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", role: businessRoles[0], job: "" });
  const [rights, setRights] = useState<Permissions | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "add" }
    | { kind: "delete"; user: User }
    | { kind: "info"; title: string; content: string }
    | null
  >(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(users));
    } catch {
      /* In-memory edits still work. */
    }
  }, [users]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const needle = query.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    const rows = users.filter(
      (user) =>
        user.status !== "Removed" &&
        `${user.name} ${user.email} ${user.role} ${user.job}`.toLowerCase().includes(needle),
    );
    return [...rows].sort((a, b) =>
      sortName ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
  }, [users, needle, sortName]);
  const administrators = visibleUsers.filter((user) => adminRoles.has(user.role));
  const team = visibleUsers.filter((user) => !adminRoles.has(user.role));
  const companyRows = coffeeCompanies
    .map((company, index) => ({ company, index, label: `${company.name} · ${company.location}` }))
    .filter((row) => row.label.toLowerCase().includes(needle));

  useEffect(() => {
    if (!selectedUser) {
      setRights(null);
      return;
    }
    setRights(readStoredPermissions(selectedUser));
    setEditingUser(false);
    setEditingRights(false);
    setError("");
    setDraft({
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      job: selectedUser.job,
    });
  }, [selectedUser?.id]);

  const companyForRights = selectedCompany;
  const visibleAccounts =
    selectedUser && companyForRights !== null && rights
      ? visibleAccountsForUser(selectedUser.id, editingUser ? draft.role : selectedUser.role, rights, companyForRights)
      : [];
  const account = visibleAccounts.find((row) => row.id === accountId) ?? visibleAccounts[0];

  function selectUser(user: User) {
    setSelectedUserId(user.id);
    if (tab === "users") setSelectedCompany(null);
  }

  function selectCompany(index: number) {
    setSelectedCompany(index);
    setAccountId("");
    if (tab === "companies") setSelectedUserId(null);
    setEditingRights(false);
  }

  function persistUser(next: User) {
    setUsers((current) => current.map((user) => (user.id === next.id ? next : user)));
  }

  function saveProfile() {
    if (!selectedUser || !rights) return;
    const email = draft.email.trim().toLowerCase();
    if (!draft.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a full name and a valid email address.");
      return;
    }
    if (users.some((user) => user.id !== selectedUser.id && user.email.toLowerCase() === email)) {
      setError("This email address is already assigned to another user.");
      return;
    }
    if (!draft.job.trim()) {
      setError("Enter a job title.");
      return;
    }
    const nextRights = withToken(rights);
    try {
      localStorage.setItem(permissionsStorageKey(selectedUser.id), JSON.stringify(nextRights));
    } catch {
      setError("Changes could not be saved. Please try again.");
      return;
    }
    persistUser({
      ...selectedUser,
      name: draft.name.trim(),
      email,
      role: draft.role,
      job: draft.job.trim(),
    });
    setRights(nextRights);
    setEditingUser(false);
    setError("");
  }

  function changeRole(role: string) {
    if (!selectedUser) return;
    setDraft((current) => ({ ...current, role }));
    setRights(seedPermissionsForUser({ id: selectedUser.id, role }));
    setAccountId("");
  }

  function saveRights() {
    if (!selectedUser || !rights) return;
    if (
      paymentTypes.some((name) => {
        const limit = rights.limits[name] ?? "";
        return limit.trim() === "" || !/^\d+(\.\d{1,2})?$/.test(limit) || Number(limit) < 0;
      })
    ) {
      setError("Enter non-negative daily limits with up to two decimal places.");
      return;
    }
    const saved = withToken(rights);
    try {
      localStorage.setItem(permissionsStorageKey(selectedUser.id), JSON.stringify(saved));
    } catch {
      setError("Changes could not be saved. Please try again.");
      return;
    }
    setRights(saved);
    setEditingRights(false);
    setError("");
  }

  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    const job = String(data.get("job") || "").trim();
    const role = String(data.get("role") || businessRoles[0]);
    if (!name || !job || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Enter a name, job, and valid email.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email)) {
      setFormError("This email address is already assigned to another user.");
      return;
    }
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      role,
      job,
      status: "Needs approval",
      avatar: null,
    };
    setUsers((current) => [...current, user]);
    setDialog(null);
    setFormError("");
    setTab("users");
    setQuery("");
    setNotice(`${name} added and awaiting approval.`);
  }

  function removeUser(user: User) {
    try {
      localStorage.removeItem(permissionsStorageKey(user.id));
    } catch {
      /* The person still leaves the list. */
    }
    setUsers((current) => current.filter((row) => row.id !== user.id));
    setSelectedUserId(null);
    setSelectedCompany(null);
    setDialog(null);
  }

  function accountChecked(row: DemoCompanyAccount) {
    if (!selectedUser || !rights || selectedCompany === null) return false;
    if (row.id in rights.accounts) return rights.accounts[row.id];
    return seedAccountAccess(selectedUser.id, selectedUser.role, rights, selectedCompany)[row.id] ?? false;
  }

  const showUserPanel = tab === "users" ? Boolean(selectedUser) : selectedCompany !== null;
  const showRightsPanel = Boolean(selectedUser && selectedCompany !== null);
  const authType = rights ? (rights.mfa ? (rights.token === "Hard token" ? "Hard token" : "Soft token") : "No token") : "No token";

  return (
    <div className="proposal-three">
      <a className="skip-link" href="#proposal-three-main">
        Skip to user management
      </a>
      <header>
        <div className="brand-bar">
          <div className="brand-left">
            <button className="icon-button" type="button" aria-label="Open navigation menu" onClick={() => setDialog({ kind: "info", title: "Navigation", content: "This preview is Access & Security Manager, proposal 3." })}>
              <Icon src={assets.imgFill} inverse />
            </button>
            <img className="brand-logo" src={assets.imgGroup} alt="Chase for Business" />
          </div>
          <div className="brand-actions">
            <button className="icon-button" type="button" aria-label="Search users" onClick={() => searchRef.current?.focus()}>
              <Icon src={assets.imgFill1} inverse />
            </button>
            <button className="icon-button" type="button" aria-label="Help" onClick={() => setDialog({ kind: "info", title: "Access & Security Manager help", content: "Choose a person, then a company, then review the accounts and entitlements for that company. Status stays a tag. Turning off multi-factor authentication means no token." })}>
              <Icon src={assets.imgFill2} inverse />
            </button>
            <button className="icon-button messages" type="button" aria-label="Messages, 5 unread" onClick={() => setDialog({ kind: "info", title: "Messages", content: "Messages are not connected in this local preview." })}>
              <Icon src={assets.imgFill3} inverse />
              <span className="badge">5</span>
            </button>
            <button className="icon-button" type="button" aria-label="Profile" onClick={() => setDialog({ kind: "info", title: "Profile", content: "You are viewing the Bean & Branch sample roster." })}>
              <Icon src={assets.imgFill4} inverse />
            </button>
            <a className="account-link" href="https://www.chase.com/business" target="_blank" rel="noreferrer">
              Open an account
            </a>
            <button className="sign-out" type="button" onClick={() => setDialog({ kind: "info", title: "Sign out", content: "This preview has no connected banking session to sign out of." })}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Business banking">
          {["Account", "Pay & transfer", "Collect & deposit", "Tools & insights", "Access & security"].map((label) => (
            <button
              key={label}
              type="button"
              aria-current={label === "Access & security" ? "page" : undefined}
              onClick={() => {
                if (label !== "Access & security") {
                  setDialog({ kind: "info", title: label, content: "This preview implements Access & Security Manager." });
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="back-bar">
        <button
          type="button"
          onClick={() => {
            setSelectedUserId(null);
            setSelectedCompany(null);
          }}
        >
          <Icon src={assets.imgFill5} />
          Back
        </button>
        <div>Access &amp; Security Manager</div>
      </div>
      <main id="proposal-three-main" className="p3-main">
        <div className="p3-subnav" aria-label="Access and security sections">
          {["All users", "Account activity", "Chase Dual Control", "IP Security", "Demos and user guides"].map((label) => (
            <button
              key={label}
              type="button"
              aria-current={label === "All users" ? "page" : undefined}
              onClick={() => {
                if (label !== "All users") setNotice("This preview covers All users.");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {notice && <p className="p3-notice">{notice}</p>}
        <div className="p3-stage">
          <section className="p3-panel" aria-label={tab === "users" ? "Users" : "Companies"}>
            <div className="p3-tabs" role="tablist" aria-label="View by">
              <button type="button" role="tab" aria-selected={tab === "users"} onClick={() => { setTab("users"); setSelectedCompany(null); setSelectedUserId(null); }}>
                Users
              </button>
              <button type="button" role="tab" aria-selected={tab === "companies"} onClick={() => { setTab("companies"); setSelectedCompany(null); setSelectedUserId(null); }}>
                Companies
              </button>
            </div>
            <label className="p3-search">
              <span className="visually-hidden">Search</span>
              <input
                ref={searchRef}
                id="p3-search"
                value={query}
                placeholder={tab === "users" ? "Search users" : "Search companies"}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="p3-scroll">
              {tab === "users" ? (
                <>
                  <UserGroup title="Administrators" users={administrators} selectedId={selectedUserId} onSelect={selectUser} sortName={sortName} onSort={() => setSortName((value) => !value)} />
                  <UserGroup title="Team" users={team} selectedId={selectedUserId} onSelect={selectUser} />
                  {visibleUsers.length === 0 && <p className="p3-empty">No users match that search.</p>}
                </>
              ) : companyRows.length === 0 ? (
                <p className="p3-empty">No companies match that search.</p>
              ) : (
                <div className="p3-group">
                  {companyRows.map((row) => (
                    <button
                      type="button"
                      className="p3-company"
                      key={row.index}
                      aria-current={selectedCompany === row.index}
                      onClick={() => selectCompany(row.index)}
                    >
                      <span className="p3-company-copy">
                        <span className="p3-person-name">{row.company.location}</span>
                        <span className="p3-meta">{row.company.name}</span>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tab === "users" && (
              <button className="primary-button p3-add" type="button" onClick={() => { setFormError(""); setDialog({ kind: "add" }); }}>
                Add a user
              </button>
            )}
          </section>

          {showUserPanel && tab === "users" && selectedUser && (
            <section className="p3-panel p3-panel-enter" aria-label={`${selectedUser.name} details`}>
              <div className="p3-block">
                <div className="p3-profile-top">
                  <div>
                    <h2 className="p3-profile-name">{selectedUser.name}</h2>
                    <p className="p3-meta">
                      <span className={`tag status-tag ${statusClass(selectedUser.status)}`}>{selectedUser.status}</span>
                      {" · "}
                      {selectedUser.role}
                    </p>
                  </div>
                  {editingUser ? (
                    <button className="p3-edit" type="button" onClick={saveProfile}>Save</button>
                  ) : (
                    <button className="p3-edit" type="button" onClick={() => { setEditingRights(false); setEditingUser(true); setError(""); }}>
                      Edit
                      <Chevron size={12} />
                    </button>
                  )}
                </div>
                {editingUser && error && <p className="p3-feedback" role="alert">{error}</p>}
                {editingUser ? (
                  <div className="p3-fields">
                    <label>
                      Full name
                      <input value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                    </label>
                    <label>
                      Email address
                      <input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                    </label>
                    <RoleSelect value={draft.role} onChange={changeRole} />
                    <p className="p3-meta">{roleDescriptions[draft.role]}</p>
                    <label>
                      Job title
                      <input value={draft.job} maxLength={80} onChange={(event) => setDraft({ ...draft, job: event.target.value })} />
                    </label>
                    <div className="p3-status-row">
                      <span>Status</span>
                      <span className={`tag status-tag ${statusClass(selectedUser.status)}`}>{selectedUser.status}</span>
                    </div>
                  </div>
                ) : (
                  <dl className="p3-facts">
                    <div><dt>Job</dt><dd>{selectedUser.job}</dd></div>
                    <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                    <div><dt>Role</dt><dd>{selectedUser.role}</dd></div>
                  </dl>
                )}
                {rights && (
                  <div className="p3-auth">
                    <h3>Authentication</h3>
                    {editingUser ? (
                      <>
                        <label className="p3-option">
                          <input
                            type="checkbox"
                            checked={rights.mfa}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              setRights({
                                ...rights,
                                mfa: enabled,
                                token: enabled ? (rights.token === "Hard token" ? "Hard token" : "Soft token") : "No token",
                              });
                            }}
                          />
                          Multi-factor authentication
                        </label>
                        <fieldset>
                          <legend>Authentication type</legend>
                          {rights.mfa ? (
                            (["Soft token", "Hard token"] as const).map((token) => (
                              <label className="p3-option" key={token}>
                                <input type="radio" name="p3-token" checked={authType === token} onChange={() => setRights({ ...rights, token })} />
                                {token}
                              </label>
                            ))
                          ) : (
                            <p className="p3-implied">No token</p>
                          )}
                        </fieldset>
                      </>
                    ) : (
                      <p className="p3-meta">{authType}</p>
                    )}
                  </div>
                )}
                <div className="p3-companies">
                  <h3>Companies</h3>
                </div>
              </div>
              <div className="p3-scroll">
                {companiesFor(editingUser ? { ...selectedUser, role: draft.role } : selectedUser).map((index) => {
                  const entitled = visibleAccountsForUser(
                    selectedUser.id,
                    editingUser ? draft.role : selectedUser.role,
                    rights ?? readStoredPermissions(selectedUser),
                    index,
                  ).length;
                  return (
                    <button type="button" className="p3-company" key={index} aria-current={selectedCompany === index} onClick={() => selectCompany(index)}>
                      <span className="p3-company-copy">
                        <span className="p3-person-name">{coffeeCompanies[index].location}</span>
                        <span className="p3-meta">{coffeeCompanies[index].name} · {entitled} accounts</span>
                      </span>
                      <Chevron />
                    </button>
                  );
                })}
              </div>
              <div className="p3-block">
                {editingUser ? (
                  <button className="p3-ghost" type="button" onClick={() => { setEditingUser(false); setRights(readStoredPermissions(selectedUser)); setError(""); }}>
                    Cancel
                  </button>
                ) : (
                  <button className="p3-text-button" type="button" onClick={() => setDialog({ kind: "delete", user: selectedUser })}>
                    Remove user
                  </button>
                )}
              </div>
            </section>
          )}

          {showUserPanel && tab === "companies" && selectedCompany !== null && (
            <section className="p3-panel p3-panel-enter" aria-label={`${coffeeCompanies[selectedCompany].location} users`}>
              <div className="p3-block">
                <h2 className="p3-profile-name">{coffeeCompanies[selectedCompany].location}</h2>
                <p className="p3-meta">{coffeeCompanies[selectedCompany].name}</p>
              </div>
              <div className="p3-scroll">
                {users
                  .filter((user) => user.status !== "Removed" && companyIndex(user.id) === selectedCompany)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((user) => (
                    <button type="button" className="p3-person" key={user.id} aria-checked={user.id === selectedUserId} onClick={() => selectUser(user)}>
                      <Avatar user={user} />
                      <span className="p3-person-copy">
                        <span className="p3-person-name">{user.name}</span>
                        <span className="p3-meta">{user.role}</span>
                      </span>
                      <span className="p3-radio" />
                    </button>
                  ))}
              </div>
            </section>
          )}

          {showRightsPanel && selectedUser && selectedCompany !== null && rights && (
            <section className="p3-panel p3-panel-rights p3-panel-enter" aria-label={`${coffeeCompanies[selectedCompany].location} permissions`}>
              <div className="p3-block">
                <div className="p3-profile-top">
                  <div>
                    <h2 className="p3-profile-name">{coffeeCompanies[selectedCompany].location}</h2>
                    <p className="p3-meta">{selectedUser.name} · {selectedUser.role}</p>
                  </div>
                  {account && (
                    editingRights ? (
                      <button className="p3-edit" type="button" onClick={saveRights}>Save</button>
                    ) : (
                      <button className="p3-edit" type="button" onClick={() => { setEditingUser(false); setEditingRights(true); setError(""); }}>
                        Edit
                        <Chevron size={12} />
                      </button>
                    )
                  )}
                </div>
                {error && <p className="p3-feedback" role="alert">{error}</p>}
                {visibleAccounts.length === 0 ? (
                  <p className="p3-empty">This role has no accounts at {coffeeCompanies[selectedCompany].location}.</p>
                ) : (
                  <div className="p3-fields">
                    <SolidSelect
                      label="Account"
                      value={account?.id ?? ""}
                      options={visibleAccounts.map((row) => ({ id: row.id, label: formatAccountLabel(row, selectedUser.id) }))}
                      onChange={setAccountId}
                    />
                  </div>
                )}
              </div>
              {account && (
                <div className="p3-scroll">
                  <div className="p3-section">
                          <label className="p3-option">
                            <input
                              type="checkbox"
                              checked={accountChecked(account)}
                              onClick={(event) => {
                                if (!editingRights) event.preventDefault();
                              }}
                              onChange={(event) => {
                                if (!editingRights) return;
                                setRights({ ...rights, accounts: { ...rights.accounts, [account.id]: event.target.checked } });
                              }}
                            />
                            Can use this account
                          </label>
                  </div>
                  {sectionsFor(account.product).map((section) => (
                    <div className="p3-section" key={section.title}>
                      <h3>{section.title}</h3>
                      {section.names.map((name) => (
                        <div className="p3-right-row" key={name}>
                          <label className="p3-option">
                            <input
                              type="checkbox"
                              checked={Boolean(rights.allowed[name])}
                              onClick={(event) => {
                                if (!editingRights) event.preventDefault();
                              }}
                              onChange={(event) => {
                                if (!editingRights) return;
                                setRights({ ...rights, allowed: { ...rights.allowed, [name]: event.target.checked } });
                              }}
                            />
                            {name}
                          </label>
                          {paymentTypes.includes(name) && (
                            editingRights ? (
                              <label className="p3-limit">
                                Daily limit
                                <input
                                  inputMode="decimal"
                                  aria-label={`${name} daily limit`}
                                  value={rights.limits[name] ?? ""}
                                  onChange={(event) => setRights({ ...rights, limits: { ...rights.limits, [name]: event.target.value } })}
                                />
                              </label>
                            ) : (
                              <p className="p3-limit">{money(rights.limits[name] ?? "0")}</p>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {editingRights && (
                <div className="p3-actions">
                  <button className="p3-ghost" type="button" onClick={() => { setEditingRights(false); setRights(readStoredPermissions(selectedUser)); setError(""); }}>
                    Cancel
                  </button>
                  <button className="primary-button" type="button" onClick={saveRights}>Save changes</button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      {dialog && (
        <Modal
          title={dialog.kind === "add" ? "Add a user" : dialog.kind === "delete" ? `Remove ${dialog.user.name}?` : dialog.title}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "add" ? (
            <form onSubmit={addUser}>
              <p className="dialog-description">New people are added to the shared Bean & Branch roster and need approval.</p>
              <label>Full name<input name="name" required autoFocus maxLength={80} /></label>
              <label>Email address<input name="email" type="email" required maxLength={160} /></label>
              <label>
                Role
                <select name="role" defaultValue={businessRoles[0]}>
                  {businessRoles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>Job<input name="job" required maxLength={80} /></label>
              {formError && <p className="p3-feedback" role="alert">{formError}</p>}
              <div className="dialog-actions">
                <button className="p3-ghost" type="button" onClick={() => setDialog(null)}>Cancel</button>
                <button className="primary-button" type="submit">Add a user</button>
              </div>
            </form>
          ) : dialog.kind === "delete" ? (
            <>
              <p className="dialog-description">{dialog.user.name} will leave this roster, including their saved permissions.</p>
              <div className="dialog-actions">
                <button className="p3-ghost" type="button" onClick={() => setDialog(null)}>Cancel</button>
                <button className="primary-button" type="button" onClick={() => removeUser(dialog.user)}>Remove user</button>
              </div>
            </>
          ) : (
            <p className="dialog-description">{dialog.content}</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function UserGroup({
  title,
  users,
  selectedId,
  onSelect,
  sortName,
  onSort,
}: {
  title: string;
  users: User[];
  selectedId: string | null;
  onSelect: (user: User) => void;
  sortName?: boolean;
  onSort?: () => void;
}) {
  if (users.length === 0 && !onSort) return null;
  return (
    <div className="p3-group">
      <div className="p3-group-head">
        <h2>{title}</h2>
        {onSort && (
          <button className="p3-sort" type="button" onClick={onSort}>
            Sort by: {sortName ? "Name" : "Name, reversed"}
            <Chevron size={16} direction="down" />
          </button>
        )}
      </div>
      {users.map((user) => (
        <button type="button" className="p3-person" key={user.id} aria-checked={user.id === selectedId} onClick={() => onSelect(user)}>
          <Avatar user={user} />
          <span className="p3-person-copy">
            <span className="p3-person-name">{user.name}</span>
            <span className="p3-meta">
              <span className={`tag status-tag ${statusClass(user.status)}`}>{user.status}</span>
              {" · "}
              {user.role}
            </span>
          </span>
          <span className="p3-radio" />
        </button>
      ))}
    </div>
  );
}
