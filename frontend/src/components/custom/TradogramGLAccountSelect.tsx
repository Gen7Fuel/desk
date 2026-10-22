import type { GLAccount } from '@/lib/tradogram-api'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  accounts: Array<GLAccount>
  value: string
  onValueChange: (code: string) => void
  label: string
  disabled?: boolean
  id?: string
}

export function TradogramGLAccountSelect({
  accounts,
  value,
  onValueChange,
  label,
  disabled,
  id,
}: Props) {
  const selected = accounts.find((account) => account.code === value)
  return (
    <Select
      value={value || 'unselected'}
      onValueChange={(code) => onValueChange(code === 'unselected' ? '' : code)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        className="w-full min-w-[220px] max-w-sm"
      >
        <SelectValue placeholder="Choose GL account">
          {selected
            ? `${selected.number} — ${selected.name}`
            : value
              ? 'Unavailable account — select again'
              : 'Choose GL account'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unselected">Choose GL account</SelectItem>
        {value && !selected && (
          <SelectItem value={value} disabled>
            Unavailable account — select again
          </SelectItem>
        )}
        {(['loan', 'inventory'] as const).map((type) => (
          <SelectGroup key={type}>
            <SelectLabel>
              {type === 'loan' ? 'Loan accounts' : 'Inventory accounts'}
            </SelectLabel>
            {accounts
              .filter((account) => account.type === type)
              .map((account) => (
                <SelectItem key={account.code} value={account.code}>
                  {account.number} — {account.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
