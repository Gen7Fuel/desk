import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { can } from '@/lib/permissions'
import { getCourses, getCompletions } from '@/lib/academy-api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_appbar/_sidebar/academy/completions')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.completions', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const [courseId, setCourseId] = useState<string>('all')

  const { data: courses = [] } = useQuery({
    queryKey: ['academy', 'courses'],
    queryFn: getCourses,
  })

  const { data: completions = [], isLoading } = useQuery({
    queryKey: ['academy', 'completions', courseId],
    queryFn: () => getCompletions(courseId === 'all' ? undefined : courseId),
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Completions</h1>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : completions.length === 0 ? (
        <p className="text-muted-foreground">No completions found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Code</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {completions.map((c) => (
              <TableRow key={c._id}>
                <TableCell className="font-mono text-sm">{c.employeeCode}</TableCell>
                <TableCell>{c.employeeName}</TableCell>
                <TableCell>{c.courseTitle}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(c.completedAt), 'MMM d, yyyy HH:mm')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
