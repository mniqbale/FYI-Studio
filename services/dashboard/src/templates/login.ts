// Minimal login page for the dashboard auth gate. Server-rendered HTML, matches
// the renderLayout-free standalone page style (no nav — auth wall precedes it).
import { isAuthEnabled } from '../utils/auth.js';

export function renderLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in - FYI Studio Dashboard</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <main class="dashboard-main" style="max-width: 420px; margin: 10vh auto;">
    <h1>FYI Studio Dashboard</h1>
    <p class="muted">${isAuthEnabled() ? 'Enter the dashboard access token to continue.' : 'Dashboard access token is not configured.'}</p>
    <form method="post" action="/login" class="brand-form">
      <label>Access Token
        <input type="password" name="token" placeholder="Bearer token" autocomplete="off" required>
      </label>
      <button type="submit" class="btn">Sign in</button>
      ${!isAuthEnabled() ? '<p class="muted">Auth is disabled — this page does nothing until DASHBOARD_AUTH_TOKEN is set.</p>' : ''}
    </form>
  </main>
</body>
</html>`;
}
