import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import assets from "../../assets.json";
import initialUsers from "../../users.json";
import legacyRoles from "../../legacy-user-roles.json";
import Avatar from "../../Avatar";
import Modal from "../../Modal";
import { normalizeDemoPersonas } from "../../demoPersonas";
import { ensureDefaultPendingApproval } from "../../pendingApprovals";
import PermissionsPanel from "../../PermissionsPanel";
import {
  EditorContext,
  PermissionAccountsEditor,
  PermissionCategoriesEditor,
} from "../../permissionUi";
import {
  businessRoles,
  coffeeCompanies,
  companyIndex,
  normalizeRole,
  statusClass,
} from "../../business";
import { seedAccountAccess, visibleAccountsForUser } from "../../demoAccounts";
import {
  permissionsStorageKey,
  readStoredPermissions,
  seedPermissionsForUser,
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

function Chevron({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <svg className="p3-chevron" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M7.9675 12.3545 1.202 5.6315 2.435 4.3905 7.9645 9.885 13.497 4.361 14.7335 5.5995 7.9675 12.3545Z"
        fill="currentColor"
        transform={direction === "right" ? "rotate(-90 8 8)" : undefined}
      />
    </svg>
  );
}

function CompanyEntitlements({ index }: { index: number }) {
  const userId = `company-${index}`;
  const [value, setValue] = useState<Permissions>(() => {
    const seeded = seedPermissionsForUser({ id: userId, role: "Admin" });
    return { ...seeded, accounts: seedAccountAccess(userId, "Admin", seeded, index) };
  });
  useEffect(() => {
    const seeded = seedPermissionsForUser({ id: userId, role: "Admin" });
    setValue({ ...seeded, accounts: seedAccountAccess(userId, "Admin", seeded, index) });
  }, [index, userId]);
  const company = coffeeCompanies[index];
  return (
    <EditorContext.Provider value={{ editing: false, value, setValue, userId, role: "Admin", companyIndex: index }}>
      <section className="p3-panel p3-panel-rights p3-panel-enter permissions-panel permissions-panel-embedded" aria-label={`${company.location} accounts`}>
        <div className="permissions-scroll">
          <div className="p3-block">
            <h2 className="p3-profile-name">{company.location}</h2>
            <p className="p3-meta">{company.name}</p>
          </div>
          <PermissionCategoriesEditor />
          <PermissionAccountsEditor />
        </div>
      </section>
    </EditorContext.Provider>
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

export default function ProposalThreeApp() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>(readUsers);
  const [tab, setTab] = useState<"users" | "companies">("users");
  const [query, setQuery] = useState("");
  const [sortName, setSortName] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "add"; role: string }
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

  function activateTab(next: "users" | "companies") {
    setTab(next);
    setSelectedCompany(null);
    setSelectedUserId(null);
  }

  function onManageTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next =
      event.key === "Home" ? "users" : event.key === "End" ? "companies" : tab === "users" ? "companies" : "users";
    activateTab(next);
    const id = next === "users" ? "p3-users-tab" : "p3-companies-tab";
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function selectUser(user: User) {
    setSelectedUserId(user.id);
    if (tab === "users") setSelectedCompany(null);
  }

  function closeCompanies() {
    setSelectedUserId(null);
    setSelectedCompany(null);
  }

  function selectCompany(index: number) {
    setSelectedCompany(index);
    if (tab === "companies") setSelectedUserId(null);
  }

  function persistUser(next: User) {
    setUsers((current) => current.map((user) => (user.id === next.id ? next : user)));
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
            <button className="icon-button" type="button" aria-label="Help" onClick={() => setDialog({ kind: "info", title: "Access & Security Manager help", content: "Manage your users opens a person, then their companies, then that company’s accounts and entitlements. Manage your companies opens a company’s accounts. Status stays a tag. Turning off multi-factor authentication means no token." })}>
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
          {["Accounts", "Pay & Transfer", "Collect & deposit", "Account management", "Security"].map((label) => (
            <button
              key={label}
              type="button"
              aria-current={label === "Security" ? "page" : undefined}
              onClick={() => {
                if (label !== "Security") {
                  setDialog({ kind: "info", title: label, content: "This preview is the Access and Security Manager split view." });
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main id="proposal-three-main" className="p3-main">
        <div className="p3-titlebar">
          <p className="p3-page-title">Access and Security Manager</p>
          <div className="p3-subnav" aria-label="Access and security sections">
            <button type="button" className="p3-chip" aria-current="page">All users</button>
            {["Account activity", "Chase Dual Control", "IP Security", "Demos and user guides"].map((label) => (
              <button key={label} type="button" onClick={() => setNotice("This preview covers All users.")}>
                {label}
              </button>
            ))}
          </div>
          <label className="p3-title-search">
            <span className="visually-hidden">Search</span>
            <input
              ref={searchRef}
              id="p3-search"
              value={query}
              placeholder={tab === "users" ? "Search users" : "Search companies"}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {notice && <p className="p3-notice">{notice}</p>}
        <div className="p3-manage">
          <h1>Manage your</h1>
          <div className="p3-tabs" role="tablist" aria-label="Manage your">
            <button
              type="button"
              role="tab"
              id="p3-users-tab"
              aria-selected={tab === "users"}
              aria-controls="p3-list-panel"
              tabIndex={tab === "users" ? 0 : -1}
              onClick={() => activateTab("users")}
              onKeyDown={onManageTabKey}
            >
              Users
            </button>
            <button
              type="button"
              role="tab"
              id="p3-companies-tab"
              aria-selected={tab === "companies"}
              aria-controls="p3-list-panel"
              tabIndex={tab === "companies" ? 0 : -1}
              onClick={() => activateTab("companies")}
              onKeyDown={onManageTabKey}
            >
              Companies
            </button>
          </div>
        </div>
        <div className="p3-stage">
          <section
            className="p3-panel"
            id="p3-list-panel"
            role="tabpanel"
            aria-labelledby={tab === "users" ? "p3-users-tab" : "p3-companies-tab"}
          >
            <div className="p3-scroll">
              {tab === "users" ? (
                <>
                  <UserGroup title="Administrators" users={administrators} selectedId={selectedUserId} onSelect={selectUser} sortName={sortName} onSort={() => setSortName((value) => !value)} />
                  <div className="p3-list-action">
                    <button className="p3-menu-trigger" type="button" onClick={() => { setFormError(""); setDialog({ kind: "add", role: "Admin" }); }}>
                      Add an admin
                    </button>
                  </div>
                  <UserGroup title="Users" users={team} selectedId={selectedUserId} onSelect={selectUser} />
                  <div className="p3-list-action">
                    <button className="p3-menu-trigger" type="button" onClick={() => { setFormError(""); setDialog({ kind: "add", role: "Money Mover" }); }}>
                      Add a user
                    </button>
                  </div>
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
          </section>

          {tab === "users" && selectedUser && (
            <section className="p3-panel p3-panel-person p3-panel-enter" aria-label="Companies">
              <div className="p3-scroll">
                <div className="p3-panel-title">
                  <h2>Companies</h2>
                  <button type="button" className="p3-close" aria-label="Close companies" onClick={closeCompanies} />
                </div>
                {companiesFor(selectedUser).map((index) => {
                  const entitled = visibleAccountsForUser(
                    selectedUser.id,
                    selectedUser.role,
                    readStoredPermissions(selectedUser),
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
            </section>
          )}

          {tab === "users" && selectedUser && selectedCompany !== null && (
            <PermissionsPanel
              key={`${selectedUser.id}:${selectedCompany}`}
              embedded
              companyContext={selectedCompany}
              user={selectedUser}
              onClose={() => setSelectedCompany(null)}
              emailInUse={(email) => users.some((row) => row.id !== selectedUser.id && row.email.toLowerCase() === email)}
              onDelete={() => setDialog({ kind: "delete", user: selectedUser })}
              onUpdate={(patch) => persistUser({ ...selectedUser, ...patch })}
            />
          )}

          {tab === "companies" && selectedCompany !== null && <CompanyEntitlements index={selectedCompany} />}
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
                <select name="role" defaultValue={dialog.kind === "add" ? dialog.role : businessRoles[0]}>
                  {businessRoles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>Job<input name="job" required maxLength={80} /></label>
              {formError && <p className="p3-feedback" role="alert">{formError}</p>}
              <div className="dialog-actions">
                <button className="pill" type="button" onClick={() => setDialog(null)}>Cancel</button>
                <button className="primary-button" type="submit">Add a user</button>
              </div>
            </form>
          ) : dialog.kind === "delete" ? (
            <>
              <p className="dialog-description">{dialog.user.name} will leave this roster, including their saved permissions.</p>
              <div className="dialog-actions">
                <button className="pill" type="button" onClick={() => setDialog(null)}>Cancel</button>
                <button className="pill danger" type="button" onClick={() => removeUser(dialog.user)}>Remove user</button>
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
          <button
            className="p3-sort"
            type="button"
            onClick={onSort}
            aria-label={`Sort by name ${sortName ? "Z to A" : "A to Z"}`}
          >
            Sort by: Name
            <span aria-hidden="true" className={`sort-chevron${sortName ? " ascending" : ""}`} />
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
