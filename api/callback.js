// Completes the GitHub OAuth login: exchanges the code for a token
// and hands it back to the CMS window via postMessage.
export default async function handler(req, res) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
  const code = req.query?.code;

  const cookies = parseCookies(req.headers.cookie || '');
  if (req.query?.state && cookies.oauth_state && req.query.state !== cookies.oauth_state) {
    return send(res, 'error', { error: 'Invalid OAuth state' });
  }
  if (!clientId || !clientSecret) {
    return send(res, 'error', { error: 'Missing OAuth environment variables' });
  }
  if (!code) {
    return send(res, 'error', { error: 'Missing authorization code' });
  }

  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await r.json();
    if (data.access_token) {
      return send(res, 'success', { token: data.access_token, provider: 'github' });
    }
    return send(res, 'error', { error: data.error_description || data.error || 'No token returned' });
  } catch (e) {
    return send(res, 'error', { error: String(e) });
  }
}

function send(res, status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8" /></head><body>
<script>
  (function () {
    function receive(e) {
      window.opener.postMessage(${JSON.stringify(message)}, e.origin);
      window.removeEventListener('message', receive, false);
    }
    window.addEventListener('message', receive, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script>
<p>אפשר לסגור את החלון הזה.</p>
</body></html>`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function parseCookies(str) {
  return Object.fromEntries(
    str
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p[0])
      .map((p) => [p[0], decodeURIComponent(p[1] || '')])
  );
}
