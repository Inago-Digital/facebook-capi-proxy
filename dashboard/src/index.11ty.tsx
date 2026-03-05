import { App } from "./components/App.11ty"

// const API_BASE = "https://capi-proxy.inago.cz"
const API_BASE = "http://localhost:3000"

export const data = {
  title: "FB CAPI Proxy - Admin",
  description: "Multi-tenant Facebook Conversions API proxy dashboard",
}

export default function Page({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="api-base-url" content={API_BASE} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <link href="/style/global.css" rel="stylesheet" />
      </head>
      <body>
        <div id="root">
          <App />
        </div>
        <script type="module" src="/assets/client.min.js"></script>
      </body>
    </html>
  )
}
