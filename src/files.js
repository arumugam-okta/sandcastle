// Initial files shown in the editor. Replace the issuer/clientId with your Okta app values.
export default {
  '/App.js': `import React from 'react';
import { OktaAuth } from '@okta/okta-auth-js';
import { Security, useOktaAuth } from '@okta/okta-react';

const oktaAuth = new OktaAuth({
  issuer: 'https://{yourOktaDomain}/oauth2/default',
  clientId: '{clientId}',
  redirectUri: window.location.origin + '/login/callback',
});

function Status() {
  const { authState } = useOktaAuth();
  if (!authState) return <p>Loading auth state…</p>;
  return <p>Authenticated: {String(authState.isAuthenticated)}</p>;
}

export default function App() {
  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={() => {}}>
      <h1>Okta React SDK in Sandpack</h1>
      <Status />
    </Security>
  );
}
`,
};
