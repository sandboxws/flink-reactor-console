import { createFileRoute } from "@tanstack/react-router"
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  AlertTitle,
  AlertDescription,
  Switch,
  Progress,
  Separator,
  Skeleton,
  Input,
  Label,
  Textarea,
} from "@flink-reactor/ui"

function PrimitivesPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Primitives</h1>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Button</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Badge</h2>
        <div className="flex flex-wrap gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Alert</h2>
        <div className="flex flex-col gap-3 max-w-md">
          <Alert>
            <AlertTitle>Default Alert</AlertTitle>
            <AlertDescription>This is a default alert message.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Switch</h2>
        <div className="flex items-center gap-3">
          <Switch />
          <span className="text-sm text-fg-muted">Toggle</span>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Progress</h2>
        <div className="flex flex-col gap-3 max-w-md">
          <Progress value={33} />
          <Progress value={66} />
          <Progress value={100} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Sample Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg-muted">Card content goes here.</p>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Input & Label</h2>
        <div className="flex flex-col gap-3 max-w-sm">
          <div>
            <Label>Email</Label>
            <Input placeholder="name@example.com" className="mt-1" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea placeholder="Type here..." className="mt-1" />
          </div>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">Skeleton</h2>
        <div className="flex flex-col gap-3 max-w-sm">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute("/primitives/")({
  component: PrimitivesPage,
})
