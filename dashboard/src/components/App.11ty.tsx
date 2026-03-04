import { AdminApiProvider, useAdminApi } from "../context/AdminApiContext"
import { ToastProvider } from "../context/ToastContext"
import { Auth } from "./Auth"
import { Dashboard } from "./Dashboard"

function WithAuth() {
  const { loading, isConnected } = useAdminApi()

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-bg">
        <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isConnected) {
    return <Auth />
  }

  return <Dashboard />
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
