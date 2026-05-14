This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local Development

This project uses **dedicated ports** to avoid conflicts with other local projects.

| Service    | Port  | Notes                          |
|------------|-------|--------------------------------|
| Next.js    | 3002  | Frontend + API routes          |
| PostgreSQL | 5435  | Via Docker (host port)         |
| Redis      | 6382  | Via Docker (host port)         |
| Worker     | —     | Background process, no HTTP    |

### Prerequisites
- Docker Desktop running
- Node.js 20+

### Start

```bash
# 1. Start Postgres + Redis
npm run services:up

# 2. Push DB schema (first time or after migrations)
npm run db:push

# 3. Start Next.js dev server (http://localhost:3002)
npm run dev

# 4. Start background worker (separate terminal)
npm run worker
```

### Stop

```bash
# Stop Docker services
npm run services:down

# Stop Next.js and worker with Ctrl+C in their terminals
```

### Port conflict detection

If port 3002 is already in use, `next dev` will error immediately. Check with:
```bash
netstat -ano | findstr :3002
```

---

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
