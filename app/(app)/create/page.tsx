import { CreateForm } from '@/components/create/CreateForm'

export default function CreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create a New Lesson</h1>
        <p className="text-muted-foreground mt-1">
          Tell us what you want to learn — we'll build the full course.
        </p>
      </div>
      <CreateForm />
    </div>
  )
}
