import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Subscription {
  name: string
  category: string
  cost: string
  cycle: string
  renewalDate: string
  account: string
  notes?: string
}

const initialSubscriptions: Array<Subscription> = [
  {
    name: 'Google Workspace',
    category: 'Productivity',
    cost: '$14.40',
    cycle: 'Monthly per user',
    renewalDate: '2026-03-01',
    account: 'admin@company.com',
    notes: '8 users – Business Standard plan',
  },
  {
    name: 'Microsoft 365',
    category: 'Productivity',
    cost: '$22.00',
    cycle: 'Monthly per user',
    renewalDate: '2026-03-15',
    account: 'it-admin@company.com',
    notes: '3 users – Business Premium',
  },
  {
    name: 'Slack',
    category: 'Productivity',
    cost: '$8.75',
    cycle: 'Monthly per user',
    renewalDate: '2026-02-28',
    account: 'admin@company.com',
    notes: '8 users – Pro plan',
  },
  {
    name: 'AWS',
    category: 'Infrastructure',
    cost: '$1,240.00',
    cycle: 'Monthly (usage-based)',
    renewalDate: '2026-03-01',
    account: 'cloud-admin@company.com',
    notes: 'EC2, RDS, S3 – production workloads',
  },
  {
    name: 'Vercel',
    category: 'Infrastructure',
    cost: '$20.00',
    cycle: 'Monthly per member',
    renewalDate: '2026-03-05',
    account: 'dev-lead@company.com',
    notes: '2 members – Pro plan',
  },
  {
    name: 'Cloudflare',
    category: 'Infrastructure',
    cost: '$25.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-10',
    account: 'ops@company.com',
    notes: 'Pro plan – DNS, CDN, WAF',
  },
  {
    name: 'GitHub',
    category: 'Development',
    cost: '$4.00',
    cycle: 'Monthly per user',
    renewalDate: '2026-03-01',
    account: 'org-owner@company.com',
    notes: '5 users – Team plan',
  },
  {
    name: 'Linear',
    category: 'Development',
    cost: '$8.00',
    cycle: 'Monthly per user',
    renewalDate: '2026-02-20',
    account: 'dev-lead@company.com',
    notes: '5 users – Standard plan',
  },
  {
    name: 'Sage Intacct',
    category: 'Finance',
    cost: '$950.00',
    cycle: 'Monthly',
    renewalDate: '2026-04-01',
    account: 'alice.johnson',
    notes: 'Annual contract – billed monthly',
  },
  {
    name: 'Payworks',
    category: 'Finance',
    cost: '$175.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-01',
    account: 'payroll-admin',
    notes: 'Payroll processing – 8 employees',
  },
  {
    name: 'CStoreOffice',
    category: 'Operations',
    cost: '$350.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-15',
    account: 'manager',
    notes: 'Back-office management – all locations',
  },
  {
    name: 'Fusion Pro (Fuel)',
    category: 'Operations',
    cost: '$280.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-01',
    account: 'fuel-ops@company.com',
    notes: 'Fuel management system',
  },
  {
    name: 'Adobe Creative Cloud',
    category: 'Design',
    cost: '$89.99',
    cycle: 'Monthly',
    renewalDate: '2026-03-20',
    account: 'design@company.com',
    notes: 'All Apps – single license',
  },
  {
    name: 'Figma',
    category: 'Design',
    cost: '$15.00',
    cycle: 'Monthly per editor',
    renewalDate: '2026-03-01',
    account: 'design@company.com',
    notes: '2 editors – Professional plan',
  },
  {
    name: 'Verizon Business',
    category: 'Telecom',
    cost: '$320.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-05',
    account: 'acct #VZ-88421',
    notes: '8 lines – business unlimited',
  },
  {
    name: 'Comcast Business',
    category: 'Telecom',
    cost: '$189.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-10',
    account: 'acct #CB-20145',
    notes: 'Internet – Burlington office',
  },
  {
    name: 'Shaw Business',
    category: 'Telecom',
    cost: '$165.00',
    cycle: 'Monthly',
    renewalDate: '2026-03-12',
    account: 'acct #SB-77932',
    notes: 'Internet – Kelowna office',
  },
]

export const Route = createFileRoute('/_appbar/subscriptions')({
  beforeLoad: () => {
    throw redirect({ to: '/subscriptions/list' })
  },
  component: RouteComponent,
})

function RouteComponent() {
  // @ts-ignore – route uses beforeLoad redirect; RouteComponent never renders
  const { selected } = useSearch({ from: '/_appbar/subscriptions' })
  const navigate = useNavigate({ from: '/subscriptions' })
  const [subs, setSubs] = useState(initialSubscriptions)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCost, setFormCost] = useState('')
  const [formCycle, setFormCycle] = useState('Monthly')
  const [formRenewalDate, setFormRenewalDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  })
  const [formAccount, setFormAccount] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const categories = [...new Set(subs.map((s) => s.category))]

  function getNextDate(cycle: string) {
    const today = new Date()
    if (cycle === 'Yearly') {
      today.setFullYear(today.getFullYear() + 1)
    } else {
      today.setMonth(today.getMonth() + 1)
    }
    return today.toISOString().split('T')[0]
  }

  useEffect(() => {
    if (showForm) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [showForm])

  function closeForm() {
    setShowForm(false)
    setFormName('')
    setFormCategory('')
    setFormCost('')
    setFormCycle('Monthly')
    setFormRenewalDate(getNextDate('Monthly'))
    setFormAccount('')
    setFormNotes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (
      !formName.trim() ||
      !formCategory.trim() ||
      !formCost.trim() ||
      !formCycle.trim() ||
      !formRenewalDate.trim() ||
      !formAccount.trim()
    )
      return
    const newSub: Subscription = {
      name: formName.trim(),
      category: formCategory.trim(),
      cost: formCost.trim(),
      cycle: formCycle.trim(),
      renewalDate: formRenewalDate.trim(),
      account: formAccount.trim(),
      notes: formNotes.trim() || undefined,
    }
    setSubs((prev) => [...prev, newSub])
    navigate({ search: { selected: newSub.name } })
    closeForm()
  }

  const selectedSub = subs.find((s) => s.name === selected)

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 overflow-auto border-r">
        <div className="flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subscriptions
          </span>
          <Button
            variant={showForm ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              if (showForm) {
                closeForm()
              } else {
                setShowForm(true)
              }
            }}
          >
            {showForm ? (
              <X className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>
        {categories.map((category) => (
          <div key={category}>
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </div>
            {subs
              .filter((s) => s.category === category)
              .map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => navigate({ search: { selected: sub.name } })}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    selected === sub.name &&
                      'bg-accent/80 text-accent-foreground',
                  )}
                >
                  {sub.name}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {selectedSub ? (
          <div className="px-6 pt-4">
            <h2 className="mb-4 text-lg font-semibold">{selectedSub.name}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Category</TableCell>
                  <TableCell>{selectedSub.category}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Cost</TableCell>
                  <TableCell className="font-semibold">
                    {selectedSub.cost}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Billing Cycle</TableCell>
                  <TableCell>{selectedSub.cycle}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Next Renewal</TableCell>
                  <TableCell>{selectedSub.renewalDate}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Account</TableCell>
                  <TableCell className="font-mono text-sm">
                    {selectedSub.account}
                  </TableCell>
                </TableRow>
                {selectedSub.notes && (
                  <TableRow>
                    <TableCell className="font-medium">Notes</TableCell>
                    <TableCell className="text-muted-foreground">
                      {selectedSub.notes}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a subscription to view details
          </div>
        )}
      </div>

      {/* Slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="flex h-full w-80 flex-col gap-3 p-4"
        >
          <h3 className="text-sm font-semibold">New Subscription</h3>
          <Input
            ref={nameInputRef}
            placeholder="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            placeholder="Category (e.g. Infrastructure)"
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
          />
          <Input
            placeholder="Cost (e.g. $25.00)"
            value={formCost}
            onChange={(e) => setFormCost(e.target.value)}
          />
          <div className="flex gap-0">
            <Button
              type="button"
              variant={formCycle === 'Monthly' ? 'default' : 'outline'}
              className="flex-1 rounded-r-none"
              onClick={() => {
                setFormCycle('Monthly')
                setFormRenewalDate(getNextDate('Monthly'))
              }}
            >
              Monthly
            </Button>
            <Button
              type="button"
              variant={formCycle === 'Yearly' ? 'default' : 'outline'}
              className="flex-1 rounded-l-none border-l-0"
              onClick={() => {
                setFormCycle('Yearly')
                setFormRenewalDate(getNextDate('Yearly'))
              }}
            >
              Yearly
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Next Renewal
            </label>
            <Input
              type="date"
              value={formRenewalDate}
              onChange={(e) => setFormRenewalDate(e.target.value)}
            />
          </div>
          <Input
            placeholder="Account"
            value={formAccount}
            onChange={(e) => setFormAccount(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
          <Button type="submit" className="mt-1">
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
