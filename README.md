# ClipSync Auth Service

Standalone authentication service for ClipSync. This service provides Better-Auth authentication that can be used by desktop, mobile, and web applications.

## Features

- ✅ Better-Auth authentication
- ✅ Email/Password authentication
- ✅ OAuth providers (Google, GitHub)
- ✅ JWT token generation for backend API
- ✅ User session management
- ✅ Can be hosted independently

## Quick Start

### Development

```bash
# Install dependencies (from project root)
pnpm install

# Run auth service
cd apps/auth
pnpm dev
```

The service will run on `http://localhost:3001`

### Production Build

```bash
cd apps/auth
pnpm build
pnpm start
```

## Environment Variables

The service uses environment variables from the root `.env` file:

- `DATABASE_URL` - PostgreSQL connection string (required)
- `BETTER_AUTH_SECRET` - Secret for Better-Auth (required)
- `BETTER_AUTH_BASE_URL` or `AUTH_SERVICE_URL` - Base URL for auth service (default: http://localhost:3001)
- `JWT_SECRET` - Secret for JWT tokens (required)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID (optional)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret (optional)

## API Endpoints

### Authentication
- `GET/POST /api/auth/[...all]` - Better-Auth endpoints (sign-in, sign-up, sign-out, session, etc.)

### Token
- `GET /api/token` - Get JWT token for backend API (requires authenticated session)

### User
- `GET /api/user` - Get current user info (requires JWT token in Authorization header)

## Usage in Other Apps

### Desktop App
Set `NEXT_PUBLIC_BETTER_AUTH_URL` or `AUTH_SERVICE_URL` to point to this service:
```env
AUTH_SERVICE_URL=http://localhost:3001
# or
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3001
```

### Mobile App
Update the `AUTH_BASE_URL` in mobile app to point to this service:
```typescript
const AUTH_BASE_URL = "http://localhost:3001";
// or in production:
const AUTH_BASE_URL = "https://your-auth-service.com";
```

## Hosting

This service can be hosted on:
- **Railway** - See `railway.toml` for configuration. Add as new service, set environment variables, and deploy
- **Vercel** - Deploy as Next.js app
- **Any Node.js hosting** - Run `pnpm build && pnpm start`

### Railway Deployment

1. **Create a new service** in Railway
   - Connect your GitHub repository
   - Railway will auto-detect the `railway.toml` file

2. **Set Environment Variables** in Railway Dashboard:
   - `DATABASE_URL` - Reference your PostgreSQL service's DATABASE_URL
   - `BETTER_AUTH_SECRET` - Generate a random secret (e.g., `openssl rand -base64 32`)
   - `JWT_SECRET` - Generate a random secret (e.g., `openssl rand -base64 32`)
   - `BETTER_AUTH_BASE_URL` - Your Railway service URL (e.g., `https://clipsync-auth.up.railway.app`)
   - `ALLOWED_ORIGINS` - Comma-separated list (e.g., `http://localhost:3000,https://clipsync.up.railway.app`)
   - OAuth secrets (if using): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

3. **Configure Build Settings**:
   - Root Directory: Leave empty (uses repo root)
   - Build Command: Already configured in `railway.toml`
   - Start Command: Already configured in `railway.toml`

4. **Deploy**: Railway will automatically build and deploy your service

## Database Setup

The service uses the same Prisma schema as the desktop app. Make sure to:

1. Run migrations:
   ```bash
   pnpm prisma:db:push
   ```

2. Generate Prisma client:
   ```bash
   pnpm prisma:generate
   ```

## Notes

- The service runs on port 3001 by default (to avoid conflicts with desktop app on 3000)
- All apps (desktop, mobile, web) can use the same auth service
- The service is stateless - sessions are stored in the database
- CORS is handled by Next.js (configure in `next.config.js` if needed)
