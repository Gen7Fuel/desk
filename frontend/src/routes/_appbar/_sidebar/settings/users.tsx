import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { User } from '@/lib/users-api'
import type { Role } from '@/lib/roles-api'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createUser, deleteUser, getUsers, updateUser } from '@/lib/users-api'
import { getPermissionManifest, getRoles } from '@/lib/roles-api'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/_appbar/_sidebar/settings/users')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('settings.users', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const { selected } = useSearch({ from: '/_appbar/_sidebar/settings/users' })
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  })

  const selectedUser = users.find((u) => u._id === selected) ?? null

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({ email: addEmail.trim(), role: addRole || null }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      void navigate({ to: '/settings/users', search: { selected: user._id } })
      setShowAddForm(false)
      setAddEmail('')
      setAddRole('')
      setFormError(null)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      void navigate({ to: '/settings/users', search: { selected: undefined } })
    },
  })

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addEmail.trim() || createMutation.isPending) return
    createMutation.mutate()
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="flex w-72 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Users</span>
          {can('settings.users', 'create') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(true)
                void navigate({
                  to: '/settings/users',
                  search: { selected: undefined },
                })
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex-1 overflow-auto">
            {users.map((u) => (
              <button
                key={u._id}
                onClick={() => {
                  void navigate({
                    to: '/settings/users',
                    search: { selected: u._id },
                  })
                  setShowAddForm(false)
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                  selected === u._id && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <div className="truncate font-medium">{u.email}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.role ?? 'No role'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto p-6">
        {showAddForm && (
          <AddUserForm
            roles={roles}
            email={addEmail}
            role={addRole}
            onEmailChange={setAddEmail}
            onRoleChange={setAddRole}
            onSubmit={handleAddSubmit}
            onCancel={() => {
              setShowAddForm(false)
              setFormError(null)
            }}
            isPending={createMutation.isPending}
            error={formError}
          />
        )}
        {selectedUser && !showAddForm && (
          <UserDetail
            user={selectedUser}
            roles={roles}
            onDelete={() => deleteMutation.mutate(selectedUser._id)}
            isDeleting={deleteMutation.isPending}
            onUpdated={() =>
              queryClient.invalidateQueries({ queryKey: ['users'] })
            }
          />
        )}
        {!showAddForm && !selectedUser && (
          <p className="text-sm text-muted-foreground">
            Select a user or add a new one.
          </p>
        )}
      </div>
    </div>
  )
}

function AddUserForm({
  roles,
  email,
  role,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  roles: Array<Role>
  email: string
  role: string
  onEmailChange: (v: string) => void
  onRoleChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Add User</h2>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="user@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Role</label>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {roles.map((r) => (
            <option key={r._id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Add User'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function UserDetail({
  user,
  roles,
  onDelete,
  isDeleting,
  onUpdated,
}: {
  user: User
  roles: Array<Role>
  onDelete: () => void
  isDeleting: boolean
  onUpdated: () => void
}) {
  const [editRole, setEditRole] = useState(user.role ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: manifest } = useQuery({
    queryKey: ['permissionManifest'],
    queryFn: getPermissionManifest,
  })

  const rolePerms = useMemo<Record<string, unknown> | null>(() => {
    const roleObj = roles.find((r) => r.name === (editRole || user.role))
    return roleObj ? roleObj.permissions : null
  }, [roles, editRole, user.role])

  const initialResolved = useMemo(() => {
    if (!manifest) return {}
    const base = rolePerms ?? buildAllFalse(manifest as Manifest)
    // Linter expects permissionOverrides to always be defined
    return deepMergePerms(base, user.permissionOverrides)
  }, [rolePerms, user.permissionOverrides, manifest])

  const [resolved, setResolved] =
    useState<Record<string, unknown>>(initialResolved)

  // Reset editRole when the selected user changes
  useEffect(() => {
    setEditRole(user.role ?? '')
    setSaveMsg(null)
  }, [user._id])

  // Sync resolved whenever the computed baseline changes:
  // - on first load when manifest finishes fetching
  // - when the selected user changes
  // - when editRole changes (different role → different base permissions)
  useEffect(() => {
    setResolved(initialResolved)
  }, [initialResolved])

  function handlePermChange(path: Array<string>, value: boolean) {
    setSaveMsg(null)
    setResolved((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      let node = next
      for (let i = 0; i < path.length - 1; i++) {
        if (!node[path[i]]) node[path[i]] = {}
        node = node[path[i]]
      }
      node[path[path.length - 1]] = value
      return next
    })
  }

  const diffCount = rolePerms ? countDiff(rolePerms, resolved) : 0

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const overrides = rolePerms ? diffPerms(rolePerms, resolved) : resolved
      await updateUser(user._id, {
        role: editRole || null,
        permissionOverrides: overrides,
      })
      onUpdated()
      setSaveMsg('Saved.')
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {can('settings.users', 'delete') && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        )}
        {can('settings.users', 'update') && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
        {saveMsg && (
          <span className="text-sm text-muted-foreground">{saveMsg}</span>
        )}
        <h2 className="ml-auto text-base font-semibold truncate text-muted-foreground">
          {user.email}
        </h2>
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Role</label>
        <select
          value={editRole}
          onChange={(e) => {
            setEditRole(e.target.value)
            setSaveMsg(null)
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {roles.map((r) => (
            <option key={r._id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Permissions */}
      {manifest && (
        <OverridesEditor
          manifest={manifest as Manifest}
          resolved={resolved}
          rolePerms={rolePerms}
          roleName={editRole || user.role}
          diffCount={diffCount}
          onChange={handlePermChange}
        />
      )}

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">
              Delete user?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will permanently remove <strong>{user.email}</strong>. This
              action cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmDelete(false)
                  onDelete()
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Confirm'}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}

function OverridesEditor({
  manifest,
  resolved,
  rolePerms,
  roleName,
  diffCount,
  onChange,
}: {
  manifest: Manifest
  resolved: Record<string, unknown>
  rolePerms: Record<string, unknown> | null
  roleName: string | null | undefined
  diffCount: number
  onChange: (path: Array<string>, value: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  function getValue(path: Array<string>): boolean | undefined {
    let node: unknown = resolved
    for (const p of path) {
      if (!node || typeof node !== 'object') return undefined
      node = (node as Record<string, unknown>)[p]
    }
    return typeof node === 'boolean' ? node : undefined
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Permissions
        {diffCount > 0 && (
          <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs">
            {diffCount} override{diffCount !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="rounded-md border p-4 space-y-4">
          {rolePerms ? (
            <p className="text-xs text-muted-foreground">
              Showing resolved permissions for role <strong>{roleName}</strong>.
              Changes are stored as overrides on top of the role.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No role assigned. Permissions set here apply directly to this
              user.
            </p>
          )}
          <PermissionTree
            manifest={manifest}
            getValue={getValue}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type Manifest = {
  modules: Record<
    string,
    {
      actions?: Array<string>
      submodules?: Record<string, { actions: Array<string> }>
    }
  >
}

function buildAllFalse(manifest: Manifest): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [mod, def] of Object.entries(manifest.modules)) {
    if (def.actions) {
      result[mod] = Object.fromEntries(def.actions.map((a) => [a, false]))
    } else if (def.submodules) {
      result[mod] = Object.fromEntries(
        Object.entries(def.submodules).map(([sub, subDef]) => [
          sub,
          Object.fromEntries(subDef.actions.map((a) => [a, false])),
        ]),
      )
    }
  }
  return result
}

function deepMergePerms(
  base: Record<string, unknown>,
  overrides: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(base))
  if (!overrides) return result
  for (const [key, val] of Object.entries(overrides)) {
    if (typeof val === 'object' && val !== null) {
      if (!result[key] || typeof result[key] !== 'object') result[key] = {}
      for (const [subKey, subVal] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (typeof subVal === 'object' && subVal !== null) {
          if (!(result[key] as Record<string, unknown>)[subKey])
            (result[key] as Record<string, unknown>)[subKey] = {}
          Object.assign(
            (result[key] as Record<string, Record<string, unknown>>)[subKey],
            subVal,
          )
        } else {
          ;(result[key] as Record<string, unknown>)[subKey] = subVal
        }
      }
    } else {
      result[key] = val
    }
  }
  return result
}

function diffPerms(
  rolePerms: Record<string, unknown>,
  resolved: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  for (const [mod, val] of Object.entries(resolved)) {
    const roleVal = rolePerms[mod]
    if (typeof val === 'object' && val !== null) {
      const modDiff: Record<string, unknown> = {}
      for (const [key, keyVal] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (typeof keyVal === 'object' && keyVal !== null) {
          const roleSubVal =
            roleVal && typeof roleVal === 'object'
              ? (roleVal as Record<string, unknown>)[key]
              : undefined
          const subDiff: Record<string, unknown> = {}
          for (const [action, actionVal] of Object.entries(
            keyVal as Record<string, unknown>,
          )) {
            const roleAction =
              roleSubVal && typeof roleSubVal === 'object'
                ? (roleSubVal as Record<string, unknown>)[action]
                : undefined
            if (actionVal !== roleAction) subDiff[action] = actionVal
          }
          if (Object.keys(subDiff).length > 0) modDiff[key] = subDiff
        } else {
          const roleAction =
            roleVal && typeof roleVal === 'object'
              ? (roleVal as Record<string, unknown>)[key]
              : undefined
          if (keyVal !== roleAction) modDiff[key] = keyVal
        }
      }
      if (Object.keys(modDiff).length > 0) diff[mod] = modDiff
    }
  }
  return diff
}

function countDiff(
  rolePerms: Record<string, unknown>,
  resolved: Record<string, unknown>,
): number {
  let count = 0
  for (const [mod, val] of Object.entries(resolved)) {
    const roleVal = rolePerms[mod]
    if (typeof val === 'object' && val !== null) {
      for (const [key, keyVal] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (typeof keyVal === 'object' && keyVal !== null) {
          const roleSubVal =
            roleVal && typeof roleVal === 'object'
              ? (roleVal as Record<string, unknown>)[key]
              : undefined
          for (const [action, actionVal] of Object.entries(
            keyVal as Record<string, unknown>,
          )) {
            const roleAction =
              roleSubVal && typeof roleSubVal === 'object'
                ? (roleSubVal as Record<string, unknown>)[action]
                : undefined
            if (actionVal !== roleAction) count++
          }
        } else {
          const roleAction =
            roleVal && typeof roleVal === 'object'
              ? (roleVal as Record<string, unknown>)[key]
              : undefined
          if (keyVal !== roleAction) count++
        }
      }
    }
  }
  return count
}

// ── PermissionTree ───────────────────────────────────────────────────────────

const ACTIONS = ['create', 'read', 'update', 'delete'] as const

export function PermissionTree({
  manifest,
  getValue,
  onChange,
  showUndefined = false,
}: {
  manifest: {
    modules: Record<
      string,
      {
        actions?: Array<string>
        submodules?: Record<string, { actions: Array<string> }>
      }
    >
  }
  getValue: (path: Array<string>) => boolean | undefined
  onChange: (path: Array<string>, value: boolean) => void
  showUndefined?: boolean
}) {
  return (
    <div className="space-y-4">
      {Object.entries(manifest.modules).map(([mod, def]) => (
        <div key={mod}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {mod}
          </div>
          {def.actions ? (
            <ActionRow
              path={[mod]}
              actions={def.actions ?? ACTIONS}
              getValue={getValue}
              onChange={onChange}
              showUndefined={showUndefined}
            />
          ) : (
            <div className="space-y-1 pl-3">
              {Object.entries(def.submodules ?? {}).map(([sub, subDef]) => (
                <div key={sub}>
                  <div className="mb-0.5 text-xs font-medium text-foreground/70">
                    {sub}
                  </div>
                  <ActionRow
                    path={[mod, sub]}
                    actions={subDef.actions}
                    getValue={getValue}
                    onChange={onChange}
                    showUndefined={showUndefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ActionRow({
  path,
  actions,
  getValue,
  onChange,
  showUndefined,
}: {
  path: Array<string>
  actions: Array<string>
  getValue: (path: Array<string>) => boolean | undefined
  onChange: (path: Array<string>, value: boolean) => void
  showUndefined: boolean
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {actions.map((action) => {
        const val = getValue([...path, action])
        const isUndefined = val === undefined
        return (
          <label
            key={action}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 text-sm',
              isUndefined && showUndefined && 'opacity-50',
            )}
          >
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => onChange([...path, action], e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            {action}
          </label>
        )
      })}
    </div>
  )
}
