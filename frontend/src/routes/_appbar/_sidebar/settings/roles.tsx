import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { PermissionTree } from './users'
import type { Role } from '@/lib/roles-api'
import { can } from '@/lib/permissions'
import { Sidebar, SidebarHeader, SidebarItem } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createRole,
  deleteRole,
  getPermissionManifest,
  getRoles,
  updateRole,
} from '@/lib/roles-api'

export const Route = createFileRoute('/_appbar/_sidebar/settings/roles')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('settings.roles', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function buildDefaultPerms(
  manifest: ReturnType<typeof buildManifestShape>,
): Record<string, unknown> {
  const perms: Record<string, unknown> = {}
  for (const [mod, def] of Object.entries(manifest.modules)) {
    const modPerms: Record<string, unknown> = {}
    if (def.actions) {
      for (const a of def.actions) modPerms[a] = false
    }
    if (def.submodules) {
      for (const [sub, subDef] of Object.entries(def.submodules)) {
        modPerms[sub] = Object.fromEntries(
          subDef.actions.map((a) => [a, false]),
        )
      }
    }
    perms[mod] = modPerms
  }
  return perms
}

function buildManifestShape(m: unknown) {
  return m as {
    modules: Record<
      string,
      {
        actions?: Array<string>
        submodules?: Record<string, { actions: Array<string> }>
      }
    >
  }
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const { selected } = useSearch({ from: '/_appbar/_sidebar/settings/roles' })
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  })
  const { data: manifestRaw } = useQuery({
    queryKey: ['permissionManifest'],
    queryFn: getPermissionManifest,
  })
  const manifest = manifestRaw ? buildManifestShape(manifestRaw) : null

  const selectedRole = roles.find((r) => r._id === selected) ?? null

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      void navigate({ to: '/settings/roles', search: { selected: undefined } })
    },
  })

  return (
    <div className="flex h-full">
      <Sidebar className="w-48">
        <SidebarHeader
          title="Roles"
          action={
            can('settings.roles', 'create') ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(true)
                  void navigate({
                    to: '/settings/roles',
                    search: { selected: undefined },
                  })
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : undefined
          }
        />
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex-1 overflow-auto">
            {roles.map((r) => (
              <SidebarItem
                key={r._id}
                active={selected === r._id}
                onClick={() => {
                  void navigate({
                    to: '/settings/roles',
                    search: { selected: r._id },
                  })
                  setShowAddForm(false)
                }}
              >
                <div className="font-medium">{r.name}</div>
                {r.description && (
                  <div className="truncate text-xs text-muted-foreground">
                    {r.description}
                  </div>
                )}
              </SidebarItem>
            ))}
          </div>
        )}
      </Sidebar>

      {/* Right panel */}
      <div className="flex-1 overflow-auto p-6">
        {showAddForm && manifest && (
          <AddRoleForm
            manifest={manifest}
            onSuccess={(role) => {
              queryClient.invalidateQueries({ queryKey: ['roles'] })
              void navigate({
                to: '/settings/roles',
                search: { selected: role._id },
              })
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
        {selectedRole && !showAddForm && manifest && (
          <RoleDetail
            key={selectedRole._id}
            role={selectedRole}
            manifest={manifest}
            onDelete={() => deleteMutation.mutate(selectedRole._id)}
            isDeleting={deleteMutation.isPending}
            onUpdated={() =>
              queryClient.invalidateQueries({ queryKey: ['roles'] })
            }
          />
        )}
        {!showAddForm && !selectedRole && (
          <p className="text-sm text-muted-foreground">
            Select a role or create a new one.
          </p>
        )}
      </div>
    </div>
  )
}

function AddRoleForm({
  manifest,
  onSuccess,
  onCancel,
}: {
  manifest: ReturnType<typeof buildManifestShape>
  onSuccess: (role: Role) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Record<string, unknown>>(
    buildDefaultPerms(manifest),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getValue(path: Array<string>): boolean | undefined {
    let node: unknown = permissions
    for (const p of path) {
      if (!node || typeof node !== 'object') return undefined
      node = (node as Record<string, unknown>)[p]
    }
    return typeof node === 'boolean' ? node : undefined
  }

  function handleChange(path: Array<string>, value: boolean) {
    setPermissions((prev) => {
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

  function toggleAll(value: boolean) {
    setPermissions(
      JSON.parse(
        JSON.stringify(buildDefaultPerms(manifest)).replace(
          /false/g,
          String(value),
        ),
      ),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const role = await createRole({
        name: name.trim(),
        description,
        permissions,
      })
      onSuccess(role)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create role.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <h2 className="text-lg font-semibold">New Role</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <Input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. manager"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
      </div>

      <PermissionsSection
        manifest={manifest}
        getValue={getValue}
        onChange={handleChange}
        onToggleAll={toggleAll}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create Role'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RoleDetail({
  role,
  manifest,
  onDelete,
  isDeleting,
  onUpdated,
}: {
  role: Role
  manifest: ReturnType<typeof buildManifestShape>
  onDelete: () => void
  isDeleting: boolean
  onUpdated: () => void
}) {
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description)
  const [permissions, setPermissions] = useState<Record<string, unknown>>(
    role.permissions,
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset when role changes
  const staleRoleId = role._id
  if (permissions !== role.permissions && !saving) {
    // only reset if user hasn't modified yet — handled via key on parent
  }

  function getValue(path: Array<string>): boolean | undefined {
    let node: unknown = permissions
    for (const p of path) {
      if (!node || typeof node !== 'object') return undefined
      node = (node as Record<string, unknown>)[p]
    }
    return typeof node === 'boolean' ? node : undefined
  }

  function handleChange(path: Array<string>, value: boolean) {
    setSaveMsg(null)
    setPermissions((prev) => {
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

  function toggleAll(value: boolean) {
    setSaveMsg(null)
    setPermissions(
      JSON.parse(
        JSON.stringify(buildDefaultPerms(manifest)).replace(
          /false/g,
          String(value),
        ),
      ),
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      await updateRole(role._id, { name, description, permissions })
      onUpdated()
      setSaveMsg('Saved.')
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div key={staleRoleId} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit Role</h2>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className="text-sm text-muted-foreground">{saveMsg}</span>
          )}
          {can('settings.roles', 'delete') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          {can('settings.roles', 'update') && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaveMsg(null)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSaveMsg(null)
            }}
          />
        </div>
      </div>

      <PermissionsSection
        manifest={manifest}
        getValue={getValue}
        onChange={handleChange}
        onToggleAll={toggleAll}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">
              Delete role?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will permanently remove <strong>{role.name}</strong>. This
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

function PermissionsSection({
  manifest,
  getValue,
  onChange,
  onToggleAll,
}: {
  manifest: ReturnType<typeof buildManifestShape>
  getValue: (path: Array<string>) => boolean | undefined
  onChange: (path: Array<string>, value: boolean) => void
  onToggleAll: (value: boolean) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Permissions</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => onToggleAll(true)}
          >
            Grant All
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => onToggleAll(false)}
          >
            Revoke All
          </Button>
        </div>
      </div>
      <div className="rounded-md border p-4">
        <PermissionTree
          manifest={manifest}
          getValue={getValue}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
