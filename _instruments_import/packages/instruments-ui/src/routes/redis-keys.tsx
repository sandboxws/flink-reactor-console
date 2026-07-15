import { KeyBrowser } from "../components/redis/key-browser"

export function RedisKeysRoute({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<{
    to: string
    search?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  return (
    <KeyBrowser
      instrumentName={instrumentName}
      LinkComponent={LinkComponent}
    />
  )
}
