# FairView web app

React app for HR, managers and employees, plus the client's rating page (`/rate/:token`), which works without an account.

## Run

The API must be running on port 5000 (see [../server/README.md](../server/README.md)).

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

In development, Vite sends every `/api` call to `http://localhost:5000`, so nothing needs configuring.

## Build for production

```bash
VITE_API_URL=https://your-api.example.com npm run build
```

Serve the `dist/` folder from any static host (Vercel, Netlify, Nginx). Send every unknown path to `index.html` so links like `/rate/...` work. On the API, set `APP_URL` to this app's address (email links point there) and add it to `CORS_ORIGIN`.

## Screens

| Address | Who |
| --- | --- |
| `/login`, `/signup` | Everyone; sign-up creates a new company and its HR admin |
| `/invite/:token` | A new person choosing their password |
| `/rate/:token` | The client, from the email link |
| `/work`, `/record` | Employee |
| `/review`, `/team`, `/projects` | Manager |
| `/hr`, `/hr/gap-cards`, `/hr/people`, `/projects`, `/hr/audit` | HR |
| `/dev/outbox` | Development only: emails that would have been sent |

## Design

- One typeface, Atkinson Hyperlegible Next, served with the app.
- The manager's rating is always an **indigo square**, the client's a **teal ring**, joined by a line on the same 1 to 5 scale (`src/components/Pair.jsx`). Shape and colour both carry the meaning.
- Colours and radii are tokens in `src/index.css`.
- The Gap Card pages load the chart library only when HR opens them, which keeps the client's page small.
