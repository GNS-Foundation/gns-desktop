# 🐆 Panthera Browser

**Browse the Identity Web** - Search people, places, and organizations by @handle.

Powered by [GNS Protocol](https://gcrumbs.com) • Patent Pending #63/948,788

![Panthera Browser](./public/favicon.svg)

## Features

- 🔍 **Search by @handle** - Find identities on the Identity Web
- 🌓 **Dark/Light Mode** - Toggle between themes
- 👤 **Profile Viewing** - See identity details, stats, and facets
- 🔐 **Sign In** - Connect your GNS identity
- 📱 **Responsive** - Works on desktop and mobile

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Deployment

### Railway (Recommended) 🚂

You already have Railway set up! Deploy in seconds:

```bash
# Option 1: Railway CLI
railway login
railway init
railway up

# Option 2: Connect GitHub repo
# 1. Push to GitHub
# 2. Railway Dashboard → New Project → Deploy from GitHub repo
# 3. Railway auto-detects React and builds it
```

**Railway Settings:**
- Build Command: `npm run build`
- Start Command: `npx serve -s build -l $PORT`
- Or use the Nixpacks buildpack (auto-detected)

**Custom Domain:**
1. Railway Dashboard → Your Project → Settings → Domains
2. Add: `panthera.gcrumbs.com`
3. Add CNAME record in Cloudflare: `panthera` → `your-app.up.railway.app`

### Cloudflare Pages (Alternative)

1. Run `npm run build`
2. Go to Cloudflare Dashboard → Pages
3. Create project → Upload `build` folder
4. Set custom domain: `panthera.gcrumbs.com`

### Static Export for Any Host

```bash
npm run build
# Upload the /build folder to any static host
```

## Project Structure

```
panthera-browser/
├── public/
│   ├── index.html      # HTML template
│   └── favicon.svg     # Panther logo
├── src/
│   ├── App.js          # Main application
│   ├── index.js        # React entry point
│   └── index.css       # Tailwind styles
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Demo Handles

Try searching for these:
- `@gcrumbs` - Globe Crumbs organization
- `@camiloayerbe` - Founder profile
- `@colosseum` - Landmark in Rome
- `@echo` - Test bot

## Tech Stack

- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Create React App** - Build tooling

## Custom Domain Setup

1. Build the project: `npm run build`
2. Deploy to your hosting provider
3. Add DNS records:
   - `CNAME panthera.gcrumbs.com → your-deployment.vercel.app`
   - Or A record pointing to your server IP

## Environment Variables

None required for the demo. For production with real GNS API:

```env
REACT_APP_GNS_API_URL=https://api.gcrumbs.com
REACT_APP_GNS_API_KEY=your_api_key
```

## License

Copyright © 2025 GNS Protocol. All rights reserved.

---

**Get your @handle** → Download GNS Browser for [iOS](#) / [Android](#)
