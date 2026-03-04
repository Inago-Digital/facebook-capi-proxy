# React Static

A blazing fast static site built with React, Eleventy, and Tailwind CSS.

## Development

```bash
# Install dependencies
pnpm install

# Configure dashboard API base URL
cp .env.example .env

# Start development server
pnpm dev
```

Open [http://localhost:8080](http://localhost:8080) to view your site.

`VITE_ADMIN_API_BASE_URL` controls which backend the dashboard calls.

## Build

```bash
pnpm build
```

The static site will be generated in the `_site/` directory.

## Project Structure

```
src/
├── index.11ty.tsx      # Pages (*.11ty.tsx become HTML pages)
├── client.tsx          # Client-side hydration entry
├── components/         # React components
├── style/              # CSS files
├── utils/              # Utility functions
└── assets/             # Static assets (copied to _site/assets/)
```

## How It Works

1. **Build time**: React components are rendered to static HTML using `renderToStaticMarkup`
2. **Client**: The bundled `client.min.js` hydrates interactive components
3. **Output**: Pure static files (HTML, CSS, JS) ready for any static host

## Adding New Pages

1. Create a new `.11ty.tsx` file in `src/`
2. Export `data` for page metadata and a default component
3. If the page needs client-side interactivity, hydrate it from `client.tsx`

## Deployment

Deploy the `_site/` folder to any static hosting:

- GitHub Pages
- Netlify
- Vercel (static)
- Cloudflare Pages
- AWS S3 + CloudFront
