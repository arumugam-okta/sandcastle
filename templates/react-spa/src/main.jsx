import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js';
import { Security, LoginCallback, useOktaAuth } from '@okta/okta-react';
import './styles.css';

const oktaAuth = new OktaAuth({
  issuer: import.meta.env.VITE_OKTA_ISSUER,
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
  redirectUri: window.location.origin + '/login/callback',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
});

function Home() {
  const { authState, oktaAuth } = useOktaAuth();
  const [user, setUser] = React.useState(null);
  React.useEffect(() => {
    if (authState?.isAuthenticated) oktaAuth.getUser().then(setUser);
  }, [authState, oktaAuth]);

  if (!authState) return <p className="muted">Loading…</p>;
  if (authState.error) return <div className="error">{String(authState.error)}</div>;
  if (!authState.isAuthenticated)
    return (
      <>
        <p className="muted">You are signed out. Sign in to see the ID token claims.</p>
        <button className="btn" onClick={() => oktaAuth.signInWithRedirect()}>Sign in with Okta</button>
      </>
    );
  return (
    <>
      <div className="row">
        <span className="status"><span className="dot" /> Signed in{user?.email ? ` as ${user.email}` : ''}</span>
        <button className="btn secondary" onClick={() => oktaAuth.signOut()}>Sign out</button>
      </div>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const restoreOriginalUri = async (_oktaAuth, originalUri) =>
    navigate(toRelativeUrl(originalUri || '/', window.location.origin), { replace: true });
  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <div className="shell">
        <div className="card">
          <span className="badge">@okta/okta-react</span>
          <h1>Okta React SDK</h1>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login/callback" element={<LoginCallback />} />
          </Routes>
        </div>
      </div>
    </Security>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter><App /></BrowserRouter>
);
