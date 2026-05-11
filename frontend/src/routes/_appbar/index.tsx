import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Binary,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Fuel,
  GraduationCap,
  Key,
  RefreshCw,
  Settings,
  Tablet,
  Users,
} from 'lucide-react'
import type { ElementType } from 'react'
import type { Subscription } from '@/lib/subscription-api'
import type { CdnFile } from '@/lib/cdn-api'
import { can, getTokenPayload } from '@/lib/permissions'
import { getPersonnel } from '@/lib/personnel-api'
import { getCredentials } from '@/lib/credential-api'
import { getSubscriptions } from '@/lib/subscription-api'
import { getUsers } from '@/lib/users-api'
import { getCdnFiles } from '@/lib/cdn-api'

export const Route = createFileRoute('/_appbar/')({
  component: RouteComponent,
})

function RouteComponent() {
  const payload = getTokenPayload()
  const email = payload?.email ?? ''
  const role = payload?.role ?? null

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const modules = [
    {
      key: 'admin',
      label: 'Admin',
      description: 'Personnel, access, assets, credentials & subscriptions',
      icon: BriefcaseBusiness,
      visible: can('admin', 'read'),
      to:
        [
          { path: '/personnel', perm: 'admin.personnel' },
          { path: '/access/resources', perm: 'admin.access' },
          { path: '/assets/devices', perm: 'admin.assets' },
          { path: '/credentials/categories', perm: 'admin.credentials' },
          { path: '/subscriptions/categories', perm: 'admin.subscriptions' },
        ].find((r) => can(r.perm, 'read'))?.path ?? '/personnel',
    },
    {
      key: 'fuel',
      label: 'Fuel',
      description: 'Fuel invoicing and reconciliation',
      icon: Fuel,
      visible: can('fuel', 'read'),
      to:
        [
          { path: '/fuel-invoicing', perm: 'fuel.fuelInvoicing' },
          { path: '/fuel-rec', perm: 'fuel.fuelRec' },
        ].find((r) => can(r.perm, 'read'))?.path ?? '/fuel-invoicing',
    },
    {
      key: 'cipher',
      label: 'Cipher',
      description: 'Encrypt and decrypt secure data',
      icon: Binary,
      visible: can('cipher', 'read'),
      to: '/cipher/lock',
    },
    {
      key: 'hub',
      label: 'Hub',
      description: 'CDN file management and billing',
      icon: Tablet,
      visible: can('hub', 'read'),
      to:
        [
          { path: '/hub/cdn', perm: 'hub.cdn' },
          { path: '/hub/payables', perm: 'hub.payables' },
          { path: '/hub/receivables', perm: 'hub.receivables' },
        ].find((r) => can(r.perm, 'read'))?.path ?? '/hub/cdn',
    },
    {
      key: 'issues',
      label: 'Issues',
      description: 'Track and manage station issues',
      icon: ClipboardList,
      visible: can('issues', 'read'),
      to: '/issues',
    },
    {
      key: 'academy',
      label: 'Academy',
      description: 'Courses, employees and completions',
      icon: GraduationCap,
      visible: can('academy', 'read'),
      to: '/academy/courses/',
    },
    {
      key: 'reports',
      label: 'Reports',
      description: 'Station narrative summaries',
      icon: FileText,
      visible: can('reports', 'read'),
      to: '/reports/narrative',
    },
    {
      key: 'settings',
      label: 'Settings',
      description: 'Users and role management',
      icon: Settings,
      visible: can('settings', 'read'),
      to:
        [
          { path: '/settings/users', perm: 'settings.users' },
          { path: '/settings/roles', perm: 'settings.roles' },
        ].find((r) => can(r.perm, 'read'))?.path ?? '/settings/users',
    },
  ].filter((m) => m.visible)

  const canPersonnel = can('admin.personnel', 'read')
  const canCredentials = can('admin.credentials.list', 'read')
  const canSubscriptions = can('admin.subscriptions.list', 'read')
  const canUsers = can('settings.users', 'read')
  const canCdn = can('hub.cdn', 'read')

  const { data: personnel, isLoading: personnelLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
    enabled: canPersonnel,
  })
  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: getCredentials,
    enabled: canCredentials,
  })
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
    enabled: canSubscriptions,
  })
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: canUsers,
  })
  const { data: cdnData, isLoading: cdnLoading } = useQuery({
    queryKey: ['cdn-files', 1],
    queryFn: () => getCdnFiles(1),
    enabled: canCdn,
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingRenewals = (subscriptions ?? [])
    .map((sub: Subscription) => {
      const end = new Date(sub.end_date + 'T00:00:00')
      const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000)
      return { ...sub, daysLeft }
    })
    .filter((sub) => sub.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const recentCdnFiles: Array<CdnFile> = (cdnData?.files ?? []).slice(0, 5)

  const hasStats =
    canPersonnel || canCredentials || canSubscriptions || canUsers
  const hasWidgets = canSubscriptions || canCdn

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        <DashboardHeader greeting={greeting} email={email} role={role} />

        {modules.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Modules
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {modules.map((m) => (
                <ModuleCard
                  key={m.key}
                  label={m.label}
                  description={m.description}
                  icon={m.icon}
                  to={m.to}
                />
              ))}
            </div>
          </section>
        )}

        {hasStats && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Counts
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {canPersonnel && (
                <StatCard
                  label="Personnel"
                  count={personnel?.length}
                  isLoading={personnelLoading}
                  icon={Users}
                />
              )}
              {canCredentials && (
                <StatCard
                  label="Credentials"
                  count={credentials?.length}
                  isLoading={credentialsLoading}
                  icon={Key}
                />
              )}
              {canSubscriptions && (
                <StatCard
                  label="Subscriptions"
                  count={subscriptions?.length}
                  isLoading={subscriptionsLoading}
                  icon={RefreshCw}
                />
              )}
              {canUsers && (
                <StatCard
                  label="Users"
                  count={users?.length}
                  isLoading={usersLoading}
                  icon={Users}
                />
              )}
            </div>
          </section>
        )}

        {hasWidgets && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {canSubscriptions && (
              <RenewalsWidget
                renewals={upcomingRenewals}
                isLoading={subscriptionsLoading}
              />
            )}
            {canCdn && (
              <CdnRecentWidget files={recentCdnFiles} isLoading={cdnLoading} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DashboardHeader({
  greeting,
  email,
  role,
}: {
  greeting: string
  email: string
  role: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <h1 className="truncate text-2xl font-bold tracking-tight">{email}</h1>
      </div>
      {role && (
        <span className="shrink-0 rounded-full border bg-accent/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          {role}
        </span>
      )}
    </div>
  )
}

function ModuleCard({
  label,
  description,
  icon: Icon,
  to,
}: {
  label: string
  description: string
  icon: ElementType
  to: string
}) {
  return (
    <Link
      to={to as any}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  )
}

function StatCard({
  label,
  count,
  isLoading,
  icon: Icon,
}: {
  label: string
  count: number | undefined
  isLoading: boolean
  icon: ElementType
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">
        {isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          (count ?? '—')
        )}
      </p>
    </div>
  )
}

type RenewalItem = Subscription & { daysLeft: number }

function renewalColor(days: number): string {
  if (days < 7) return 'text-destructive font-semibold'
  if (days < 30) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

function RenewalsWidget({
  renewals,
  isLoading,
}: {
  renewals: Array<RenewalItem>
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Upcoming Renewals</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : renewals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No renewals within 60 days.
        </p>
      ) : (
        <div className="space-y-2">
          {renewals.map((sub) => (
            <div
              key={sub._id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {sub.identifier}
                </span>
                <span className="text-xs capitalize text-muted-foreground">
                  {sub.billing_cycle}
                </span>
              </div>
              <span className={renewalColor(sub.daysLeft)}>
                {sub.daysLeft < 0
                  ? `${Math.abs(sub.daysLeft)}d overdue`
                  : sub.daysLeft === 0
                    ? 'Today'
                    : `${sub.daysLeft}d`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CdnRecentWidget({
  files,
  isLoading,
}: {
  files: Array<CdnFile>
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent CDN Uploads</h3>
        {}
        <Link
          to={'/hub/cdn' as any}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          View all
        </Link>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.filename}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {file.filename}
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {new Date(file.lastModified).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
