import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import assets from "./assets.json";
import PermissionsPanel from "./PermissionsPanel";
import ApprovalReviewModal from "./ApprovalReviewModal";
import CompaniesView from "./CompaniesView";
import Modal from "./Modal";
import { normalizeDemoPersonas } from "./demoPersonas";
import { ensureDefaultPendingApproval } from "./pendingApprovals";
import PendingApprovalsOverview from "./PendingApprovalsOverview";
import Avatar from "./Avatar";
import ManageSegments from "./ManageSegments";
import useStickyRows from "./useStickyRows";
import NameSortHeader from "./NameSortHeader";
import FilterDropdown from "./FilterDropdown";
import companyAssets from "./company-assets.json";
import initialUsers from "./users.json";
import legacyRoles from "./legacy-user-roles.json";
import { businessRoles, statusClass, normalizeRole, isInactive } from "./business";
import { permissionsStorageKey } from "./userPermissions";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  job: string;
  status: string;
  avatar: string | null;
};
type DialogState =
  | { kind: "add" }
  | { kind: "delete"; user: User }
  | { kind: "decline"; user: User }
  | { kind: "info"; title: string; content: string }
  | null;
const organizationName = "Bean & Branch";
const roles = businessRoles;
const storageKey = "asm-demo-users-v1";
function normalizeDemoUsers(users: User[]): User[] {
  return normalizeDemoPersonas(
    users.map((user: User) => {
      const legacy = legacyRoles[user.id as keyof typeof legacyRoles];
      const current = initialUsers.find((u) => u.id === user.id);
      const refreshed = current ? { ...user, avatar: current.avatar } : user;
      const updated =
        legacy &&
        current &&
        user.role === legacy.role &&
        user.job === legacy.job
          ? { ...refreshed, role: current.role, job: current.job }
          : refreshed;
      return { ...updated, role: normalizeRole(updated.role) };
    }),
  );
}
function readUsers(): User[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) || "null",
    );
    if (
      Array.isArray(saved) &&
      saved.every(
        (u) =>
          u &&
          ["id", "name", "email", "role", "job", "status"].every(
            (k) => typeof u[k] === "string",
          ) &&
          (u.avatar === null ||
            initialUsers.some((v) => v.avatar === u.avatar) || /^\/assets\/imgJp[1-9]\.png$/.test(u.avatar)),
      )
    )
      return ensureDefaultPendingApproval(normalizeDemoUsers(saved));
  } catch {
    /* Use design data when storage is unavailable. */
  }
  return ensureDefaultPendingApproval(normalizeDemoUsers(initialUsers));
}
function Icon({ src, inverse = false }: { src: string; inverse?: boolean }) {
  return inverse ? (
    <span
      className="masked-icon"
      style={{ maskImage: `url(${src})` }}
      aria-hidden="true"
    />
  ) : (
    <img src={src} alt="" />
  );
}
export default function App() {
  const listRef = useStickyRows();
  const [users, setUsers] = useState<User[]>(readUsers);
  useEffect(() => {
    setUsers((previous) =>
      ensureDefaultPendingApproval(normalizeDemoUsers(previous)),
    );
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"users" | "companies">("users");
  const [approval, setApproval] = useState(false);
  const [role, setRole] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [nameSort, setNameSort] = useState<"ascending" | "descending" | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "status">("name");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [companiesApprovalMode, setCompaniesApprovalMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tab !== "companies") setCompaniesApprovalMode(false);
  }, [tab]);
  useEffect(() => {
    const shouldRefresh =
      (tab === "users" && approval) ||
      (tab === "companies" && companiesApprovalMode);
    if (!shouldRefresh) return;
    setUsers((previous) =>
      ensureDefaultPendingApproval(normalizeDemoUsers(previous)),
    );
  }, [approval, companiesApprovalMode, tab]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(users));
    } catch {
      /* In-memory interactions still work. */
    }
  }, [users]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const matchesSearch = (u: User) =>
    `${u.name} ${u.email} ${u.role} ${u.job}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const visible = users.filter(
    (u) =>
      (!approval || u.status === "Needs approval") &&
      (!role.length || role.includes(u.role)) &&
      (!approval && (!status.length || status.includes(u.status))) &&
      matchesSearch(u),
  );
  if (nameSort) visible.sort((a, b) => (nameSort === "ascending" ? 1 : -1) * a[sortKey].localeCompare(b[sortKey], undefined, { sensitivity: "base" }));
  const selectedUser = users.find((user) => user.id === selectedId);
  const reviewUser = users.find((user) => user.id === reviewId);
  const pendingVisible = users.filter(
    (user) =>
      user.status === "Needs approval" &&
      (!role.length || role.includes(user.role)) &&
      matchesSearch(user),
  );
  useEffect(() => {
    if (selectedId && !visible.some((user) => user.id === selectedId))
      setSelectedId(null);
  }, [query, role, status, approval, tab, users, selectedId]);
  useEffect(() => {
    if (
      reviewId &&
      !users.some(
        (user) => user.id === reviewId && user.status === "Needs approval",
      )
    )
      setReviewId(null);
  }, [query, role, status, approval, tab, users, reviewId]);
  useEffect(() => {
    const inApprovalMode =
      (tab === "users" && approval) ||
      (tab === "companies" && companiesApprovalMode);
    if (!inApprovalMode) setReviewId(null);
  }, [approval, companiesApprovalMode, tab]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dialog) {
        setSelectedId(null);
        setReviewId(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [dialog]);
  const info = (title: string, content: string) =>
    setDialog({ kind: "info", title, content });
  function resetFilters() {
    setSelectedId(null);
    setQuery("");
    setRole([]);
    setStatus([]);
    setApproval(false);
  }
  function addUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name")).trim(),
      email = String(data.get("email")).trim().toLowerCase();
    if (!name) {
      setFormError("Enter a name.");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      setFormError("A user with this email already exists.");
      return;
    }
    setUsers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        email,
        role: String(data.get("role")),
        job: String(data.get("job")).trim(),
        status: "Needs approval",
        avatar: null,
      },
    ]);
    setDialog(null);
    resetFilters();
    setTab("users");
    setNotice(`${name} added and awaiting approval.`);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to user management
      </a>
      <header>
        <div className="brand-bar">
          <div className="brand-left">
            <button
              className="icon-button"
              aria-label="Open navigation menu"
              onClick={() =>
                info(
                  "Navigation",
                  "Use the navigation links to explore Chase business banking. This local preview implements Access & Security Manager.",
                )
              }
            >
              <Icon src={assets.imgFill} inverse />
            </button>
            <img
              className="brand-logo"
              src={assets.imgGroup}
              alt="Chase for Business"
            />
          </div>
          <div className="brand-actions">
            <button
              className="icon-button"
              aria-label="Search users"
              onClick={() => {
                setTab("users");
                searchRef.current?.focus();
              }}
            >
              <Icon src={assets.imgFill1} inverse />
            </button>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() =>
                info(
                  "Access & Security Manager help",
                  "Search by name, email, role, or job. Use Filter to narrow results. Select a user to review their details, approve new users, or remove access.",
                )
              }
            >
              <Icon src={assets.imgFill2} inverse />
            </button>
            <button
              className="icon-button messages"
              aria-label="Messages, 5 unread"
              onClick={() =>
                info(
                  "Messages",
                  "The Figma design shows 5 unread messages. Messages are not connected in this local preview.",
                )
              }
            >
              <Icon src={assets.imgFill3} inverse />
              <span className="badge">5</span>
            </button>
            <button
              className="icon-button"
              aria-label="Profile"
              onClick={() =>
                info(
                  "Profile",
                  "You are viewing a local preview using the sample users from the Figma design.",
                )
              }
            >
              <Icon src={assets.imgFill4} inverse />
            </button>
            <a
              className="account-link"
              href="https://www.chase.com/business"
              target="_blank"
              rel="noreferrer"
            >
              Open an account
            </a>
            <button
              className="sign-out"
              onClick={() =>
                info(
                  "Sign out",
                  "This preview has no connected banking session to sign out of.",
                )
              }
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Business banking">
          {[
            "Account",
            "Pay & transfer",
            "Collect & deposit",
            "Tools & insights",
            "Access & security",
          ].map((label) => (
            <button
              key={label}
              onClick={() =>
                label === "Access & security"
                  ? (setTab("users"), resetFilters())
                  : info(
                      label,
                      "This local preview implements Access & Security Manager. Visit chase.com/business for business banking services.",
                    )
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="back-bar">
        <button
          onClick={() => {
            setTab("users");
            resetFilters();
          }}
        >
          <Icon src={assets.imgFill5} />
          Back
        </button>
        <div>Access &amp; Security Manager</div>
      </div>
      <main
        id="main"
        className={
          tab === "users" && selectedUser ? "has-permissions" : ""
        }
      >
        <div className="management-heading">
          <div className="heading-tabs">
            <h1>Manage your</h1>
            <ManageSegments value={tab} onChange={(next) => {
              if (next === "companies") setSelectedId(null);
              setTab(next);
            }} />
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setFormError("");
              setDialog({ kind: "add" });
            }}
          >
            Add a user
            <Icon src={tab === "companies" ? companyAssets.imgMask1 : assets.imgMask1} />
          </button>
        </div>
        {tab === "users" ? (
          <section id="users-panel" role="tabpanel" aria-labelledby="users-tab">
            <div className="toolbar">
              <button
                className={`pill ${!approval ? "active" : ""}`}
                aria-pressed={!approval}
                onClick={() => {
                  setApproval(false);
                  setReviewId(null);
                }}
              >
                All users
              </button>
              <button
                className={`pill ${approval ? "active" : ""}`}
                aria-pressed={approval}
                onClick={() => {
                  setSelectedId(null);
                  setApproval(true);
                }}
              >
                Needs approval
              </button>
              <FilterDropdown roles={role} statuses={status} onRoles={setRole} onStatuses={setStatus} />
              <label className="search">
                <Icon src={assets.imgActionIcoSearch} />
                <input
                  ref={searchRef}
                  type="search"
                  aria-label="Search for users"
                  placeholder="Search for users"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="users-content">
              {approval ? (
                <PendingApprovalsOverview
                  pendingUsers={pendingVisible}
                  reviewId={reviewId}
                  onReview={(user) => setReviewId(user.id)}
                  onDecline={(user) => setDialog({ kind: "decline", user })}
                  onShowAll={resetFilters}
                />
              ) : (
                <>
                  <div className="users-table-content">
                    <div ref={listRef} className="user-list" role="table" aria-label="Users">
                      <div className="list-header" role="row">
                        <NameSortHeader direction={sortKey === "name" ? nameSort : null} onSort={() => { setSortKey("name"); setNameSort(sortKey === "name" && nameSort === "ascending" ? "descending" : "ascending"); }} />
                        <span role="columnheader">Role</span>
                        <span role="columnheader">Job</span>
                        <NameSortHeader label="Status" direction={sortKey === "status" ? nameSort : null} onSort={() => { setSortKey("status"); setNameSort(sortKey === "status" && nameSort === "ascending" ? "descending" : "ascending"); }} />
                        <span role="columnheader" className="sr-only">
                          Details
                        </span>
                      </div>
                      <div role="rowgroup" className="list-body">
                        {visible.map((user) => (
                          <div
                            role="row"
                            key={user.id}
                            className={`user-row ${isInactive(user.status) ? "inactive-user" : ""} ${selectedId === user.id ? "selected-user" : ""}`}
                          >
                            <div role="cell" className="identity">
                              <Avatar user={user} />
                              <div>
                                <div className="user-name">{user.name}</div>
                                <div className="user-email">{user.email}</div>
                              </div>
                            </div>
                            <div role="cell">
                              <span className={`tag role-tag ${isInactive(user.status) ? "inactive-role" : ""}`}>{isInactive(user.status) ? "N/A" : user.role}</span>
                            </div>
                            <div role="cell" className="job">
                              {user.job}
                            </div>
                            <div role="cell">
                              <span
                                className={`tag status-tag ${statusClass(user.status)}`}
                              >
                                {user.status}
                              </span>
                            </div>
                            <div role="cell">
                              <button
                                className="row-link"
                                aria-label={`View ${user.name}`}
                                aria-expanded={selectedId === user.id}
                                aria-controls={
                                  selectedUser ? "permissions-title" : undefined
                                }
                                onClick={() => setSelectedId(user.id)}
                              >
                                <Icon src={assets.imgIcon} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {visible.length === 0 && (
                      <div className="empty-state">
                        <h2>No users found</h2>
                        <p>Try another search or adjust your filters.</p>
                        <button className="text-button" onClick={resetFilters}>
                          Show all users
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedUser && (
                    <PermissionsPanel
                      user={selectedUser}
                      onUpdate={(patch) => setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, ...patch } : u))}
                      onClose={() => setSelectedId(null)}
                      emailInUse={(email) => users.some((u) => u.id !== selectedUser.id && u.email.toLowerCase() === email)}
                      onDelete={() =>
                        setDialog({ kind: "delete", user: selectedUser })
                      }
                    />
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
          <CompaniesView
            users={users}
            reviewId={reviewId}
            onReview={(user) => setReviewId(user.id)}
            onDecline={(user) => setDialog({ kind: "decline", user })}
            onApprovalModeChange={setCompaniesApprovalMode}
            onUpdate={(user, patch) =>
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)),
              )
            }
            onDelete={(user) => setDialog({ kind: "delete", user })}
          />
        )}
      </main>
      <div className="toast" role="status">
        {notice && <span>{notice}</span>}
      </div>
      {reviewUser && (
        <ApprovalReviewModal
          user={reviewUser}
          onClose={() => setReviewId(null)}
          onApprove={() => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === reviewUser.id ? { ...u, status: "Active" } : u,
              ),
            );
            setReviewId(null);
            setNotice(`${reviewUser.name} approved and activated.`);
          }}
        />
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === "add"
              ? "Add a user"
              : dialog.kind === "delete"
                ? `Delete ${dialog.user.name}?`
                : dialog.kind === "decline"
                  ? `Are you sure you want to decline the invite from ${dialog.user.name}?`
                  : dialog.title
          }
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "add" ? (
            <form onSubmit={addUser}>
              <p className="dialog-description">
                Add a user to this local preview. New users will need approval.
              </p>
              <label>
                Full name
                <input name="name" required autoFocus maxLength={80} />
              </label>
              <label>
                Email address
                <input name="email" type="email" required maxLength={160} />
              </label>
              <label>
                Role
                <select aria-label="Role" name="role">
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Job
                <input name="job" required maxLength={80} />
              </label>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="pill"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Add user
                </button>
              </div>
            </form>
          ) : dialog.kind === "delete" ? (
            <>
              <p className="dialog-description">
                {dialog.user.name} will be deleted from Bean &amp; Branch’s user list,
                including their company memberships and saved permissions.
                Their profile will no longer appear in this workspace.
              </p>
              <div className="dialog-actions">
                <button className="pill" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="pill danger"
                  onClick={() => {
                    setUsers((prev) =>
                      prev.filter((u) => u.id !== dialog.user.id),
                    );
                    localStorage.removeItem(permissionsStorageKey(dialog.user.id));
                    setSelectedId(null);
                    setDialog(null);
                    setNotice(`${dialog.user.name} deleted.`);
                  }}
                >
                  Delete user
                </button>
              </div>
            </>
          ) : dialog.kind === "decline" ? (
            <>
              <div className="decline-warning-banner" role="note">
                <span className="decline-warning-icon" aria-hidden="true">
                  !
                </span>
                <p>
                  We&apos;ll let the person who invited them know their request
                  was declined.
                </p>
              </div>
              <div className="decline-summary-card">
                <Avatar user={dialog.user} />
                <div>
                  <div className="decline-summary-heading">
                    <span className="user-name">{dialog.user.name}</span>
                    <span className="tag role-tag">{dialog.user.role}</span>
                  </div>
                  <div className="user-email">{dialog.user.email}</div>
                </div>
              </div>
              <div className="dialog-actions">
                <button className="pill" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="pill pill-decline"
                  onClick={() => {
                    setUsers((prev) =>
                      prev.filter((u) => u.id !== dialog.user.id),
                    );
                    localStorage.removeItem(
                      permissionsStorageKey(dialog.user.id),
                    );
                    if (reviewId === dialog.user.id) setReviewId(null);
                    setDialog(null);
                    setNotice(`${dialog.user.name} access request declined.`);
                  }}
                >
                  Yes, decline
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dialog-description">{dialog.content}</p>
              <div className="dialog-actions">
                <button
                  className="primary-button"
                  onClick={() => setDialog(null)}
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
