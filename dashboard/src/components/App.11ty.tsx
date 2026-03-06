import { AdminApiProvider, useAdminApi } from "../context/AdminApiContext"
import { ToastProvider, useToast } from "../context/ToastContext"
import { Auth } from "./Auth"
import { Dashboard } from "./Dashboard"
import { ToastList } from "./ToastList"

function WithAuth() {
  const { loading, isConnected } = useAdminApi()
  const { toasts } = useToast()

  let content = null

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-bg">
        <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isConnected) {
    content = <Auth />
  }

  if (isConnected) {
    content = <Dashboard />
  }

  return (
    <>
      {content}
      <ToastList toasts={toasts} />
    </>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AdminApiProvider>
        <WithAuth />
      </AdminApiProvider>
    </ToastProvider>
  )
}
