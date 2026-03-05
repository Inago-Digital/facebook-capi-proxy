import { TextInput } from "./ui/Input"
import { Button } from "./ui/Button"
import { Card, CardHeader, CardTitle } from "./ui/Card"
import { useAdminApi } from "../context/AdminApiContext"

export function Auth() {
  const { connect, setSecretInput, serverUrlInput, setServerUrlInput } =
    useAdminApi()

  return (
    <div className="flex flex-col relative min-h-screen items-center justify-center bg-bg">
      <div className="absolute top-1/3 flex items-center gap-2 font-mono text-3xl font-semibold tracking-[0.04em] text-white">
        <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_8px_#1877f2] animate-pulseDot"></span>
        CAPI_PROXY
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>

        <div className="space-y-6 p-6">
          <TextInput
            placeholder="Proxy URL (e.g. https://api.example.com)"
            type="url"
            autoComplete="off"
            list="proxy-url-history"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void connect()
              }
            }}
          />

          <TextInput
            placeholder="Password"
            type="password"
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void connect()
              }
            }}
          />

          <Button className="w-full" onClick={() => void connect()}>
            Connect
          </Button>
        </div>
      </Card>
    </div>
  )
}
