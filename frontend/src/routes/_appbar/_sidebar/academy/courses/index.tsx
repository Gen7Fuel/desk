import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { EyeOff, Globe, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { can } from '@/lib/permissions'
import {
  deleteCourse,
  getCourses,
  publishCourse,
  unpublishCourse,
} from '@/lib/academy-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/academy/courses/')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.courses', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['academy', 'courses'],
    queryFn: getCourses,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] })
      toast.success('Course deleted')
    },
    onError: () => toast.error('Failed to delete course'),
  })

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      published ? unpublishCourse(id) : publishCourse(id),
    onSuccess: (_, { published }) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] })
      toast.success(published ? 'Course unpublished' : 'Course published')
    },
    onError: () => toast.error('Failed to update course'),
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
        {can('academy.courses', 'create') && (
          <Button asChild>
            <Link to="/academy/courses/$courseId" params={{ courseId: 'new' }}>
              <Plus className="mr-2 h-4 w-4" />
              New Course
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : courses.length === 0 ? (
        <p className="text-muted-foreground">
          No courses yet. Create one to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course._id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      course.status === 'published' ? 'default' : 'secondary'
                    }
                  >
                    {course.status}
                  </Badge>
                </TableCell>
                <TableCell>{course.sectionCount}</TableCell>
                <TableCell>
                  {format(new Date(course.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {can('academy.courses', 'update') && (
                      <>
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/academy/courses/$courseId"
                            params={{ courseId: course._id }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            course.status === 'published'
                              ? 'Unpublish'
                              : 'Publish'
                          }
                          onClick={() =>
                            togglePublishMutation.mutate({
                              id: course._id,
                              published: course.status === 'published',
                            })
                          }
                        >
                          {course.status === 'published' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    {can('academy.courses', 'delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this course?')) {
                            deleteMutation.mutate(course._id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
