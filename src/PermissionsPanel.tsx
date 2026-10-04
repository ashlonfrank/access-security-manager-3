import { useRef, useEffect, useLayoutEffect, useState } from "react";
import assets from "./permission-assets.json";
import RoleSelect from "./RoleSelect";
import { companyIndex, statusClass } from "./business";
import Avatar from "./Avatar";
import type { User } from "./App";
import {
  paymentTypes,
  permissionsStorageKey,
  readStoredPermissions,
  seedPermissionsForUser,
  type Permissions,
} from "./userPermissions";
import {
  EditorContext,
  PermissionAccountsEditor,
  PermissionCategoriesEditor,
} from "./permissionUi";
type PanelUser = User;
export type UserChanges = Pick<User, "name" | "email" | "role" | "job" | "status">;
function readPermissions(panelUser: PanelUser): Permissions {
  return readStoredPermissions({ id: panelUser.id, role: panelUser.role });
}
export default function PermissionsPanel({ user, onClose, emailInUse, onDelete, onUpdate, companyContext, embedded = false }: {
  user: PanelUser; onClose: () => void; emailInUse: (email: string) => boolean; onDelete: () => void;
  onUpdate: (patch: UserChanges) => void;
  /** Account catalog company. Defaults to the user's home company. */
  companyContext?: number;
  /** Flow inside a parent column instead of the overlay measurement. */
  embedded?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<Permissions>(() => readPermissions(user));
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [job, setJob] = useState(user.job);
  const [error, setError] = useState("");
  useLayoutEffect(() => {
    if (embedded) return;
    const element = panel.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const bounds = element.parentElement?.getBoundingClientRect();
      if (bounds) {
        const columnHeader = element.parentElement?.querySelector<HTMLElement>(".list-header, .company-list-header");
        const anchor = columnHeader?.getBoundingClientRect() ?? bounds;
        element.style.setProperty("--permissions-top", `${Math.max(32, anchor.top)}px`);
        element.style.setProperty("--permissions-left", `${anchor.left + anchor.width / 2 + 2}px`);
        element.style.setProperty("--permissions-width", `${anchor.width / 2 - 2}px`);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);
    const main = element.closest("main");
    if (main) observer.observe(main);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);

    };
  }, [embedded]);
  useLayoutEffect(() => {
    setValue(readPermissions(user)); setEditing(false); setError("");
    setRole(user.role); setJob(user.job); setName(user.name); setEmail(user.email); scroll.current?.scrollTo(0, 0);
  }, [user.id]);
  useEffect(() => { scroll.current?.scrollTo(0, 0); }, [user.email]);
  function beginEdit() {
    setValue(readPermissions(user)); setRole(user.role); setJob(user.job); setName(user.name); setEmail(user.email);
    setError(""); setEditing(true);
  }
  function updateRole(nextRole: string) {
    setRole(nextRole);
    setValue(seedPermissionsForUser({ id: user.id, role: nextRole }));
  }
  function cancelEdit() { setValue(readPermissions(user)); setEditing(false); setError(""); }
  function save() {
    const savedEmail = email.trim().toLowerCase();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(savedEmail)) {
      setError("Enter a full name and a valid email address."); return;
    }
    if (emailInUse(savedEmail)) { setError("This email address is already assigned to another user."); return; }
    if (!job.trim() || paymentTypes.some((name) => value.limits[name].trim() === "" || !Number.isFinite(Number(value.limits[name])) || Number(value.limits[name]) < 0 || Number(value.limits[name]) > 999999999 || !/^\d+(\.\d{1,2})?$/.test(value.limits[name]))) {
      setError("Enter a job title and non-negative daily limits with up to two decimal places."); return;
    }
    const savedPermissions: Permissions = value.mfa
      ? {
          ...value,
          token: value.token === "Hard token" ? "Hard token" : "Soft token",
        }
      : { ...value, mfa: false, token: "No token" };
    try { localStorage.setItem(permissionsStorageKey(user.id), JSON.stringify(savedPermissions)); }
    catch { setError("Changes could not be saved. Please try again."); return; }
    setValue(savedPermissions);
    onUpdate({ name: name.trim(), email: savedEmail, status: user.status, role, job: job.trim() }); setEditing(false); setError("");
  }
  const effectiveRole = editing ? role : user.role;
  const authenticationType = value.mfa
    ? value.token === "Hard token"
      ? "Hard token"
      : "Soft token"
    : "No token";
  function setMfa(enabled: boolean) {
    setValue((current) => {
      if (!enabled) {
        return { ...current, mfa: false, token: "No token" };
      }
      return {
        ...current,
        mfa: true,
        token:
          current.token === "Hard token" ? "Hard token" : "Soft token",
      };
    });
  }
  const accountCompany = companyContext ?? companyIndex(user.id);
  return <EditorContext.Provider value={{ editing, value, setValue, userId: user.id, role: effectiveRole, companyIndex: accountCompany }}>
    <aside ref={panel} className={`permissions-panel ${editing ? "editing-permissions" : ""} ${embedded ? "permissions-panel-embedded" : ""}`} id="permissions-title" aria-label="Permissions">
      <div className="permissions-scroll" ref={scroll} tabIndex={0} aria-label={`Permissions for ${user.name}`}>
        <div className="permission-profile">
          <Avatar user={user} />
          <div className="permission-name"><h3>{user.name}</h3><p>{user.email}</p></div>
          <button className="permission-close" aria-label="Close permissions" onClick={onClose}><img src={assets.imgMask2} alt="" /></button>
          <div className="permission-actions">
            {editing ? <><button className="permission-edit primary-button" onClick={save}>Save changes</button><button onClick={cancelEdit}>Cancel</button></>
              : <><button className="permission-edit" onClick={beginEdit}>Edit<img src={assets.imgMask} alt="" /></button><button className="permission-delete" onClick={onDelete}>Delete user</button></>}
          </div>
          {error && <p className="permission-feedback error" role="alert">{error}</p>}
        </div>
        <section className="permission-info">
          <div className="permission-info-heading"><h3>User info</h3></div>
          {editing ? <div className="permission-fields">
            <label>Full name<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <RoleSelect value={role} onChange={updateRole} />
            <label>Job title<input aria-label="Job title" value={job} maxLength={80} onChange={(event) => setJob(event.target.value)} /></label>
            <div className="permission-status-readonly">
              <span>Status</span>
              <span className={`tag status-tag ${statusClass(user.status)}`}>{user.status}</span>
            </div>
          </div> : <dl><div><dt>Role</dt><dd><span className="permission-small-tag">{user.role}</span></dd></div><div><dt>Status</dt><dd><span className={`tag status-tag ${statusClass(user.status)}`}>{user.status}</span></dd></div></dl>}
        </section>
        <section className="permission-info">
          <h3>User authentication</h3>
          {editing ? <div className="authentication-editor">
            <label className="permission-option"><input className="permission-checkbox" type="checkbox" checked={value.mfa} onChange={(event) => setMfa(event.target.checked)} />Multi-factor authentication</label>
            <fieldset>
              <legend>Authentication type</legend>
              {value.mfa ? (
                (["Soft token", "Hard token"] as const).map((token) => (
                  <label className="permission-option" key={token}>
                    <input
                      type="radio"
                      name={`token-${user.id}`}
                      checked={authenticationType === token}
                      onChange={() => setValue({ ...value, token })}
                    />
                    {token}
                  </label>
                ))
              ) : (
                <p className="permission-auth-implied">No token</p>
              )}
            </fieldset>
          </div> : <dl><div><dt>Multi-factor authentication</dt><dd>{value.mfa ? "Enabled" : "Disabled"}</dd></div><div><dt>Authentication type</dt><dd><span className="permission-small-tag">{authenticationType}</span></dd></div></dl>}
        </section>
        <PermissionCategoriesEditor />
        <PermissionAccountsEditor />
      </div>
    </aside>
  </EditorContext.Provider>;
}
