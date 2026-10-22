import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OktaAuth } from '@okta/okta-auth-js';
import { provideOktaAuth, withOktaConfig } from '@okta/okta-angular';
import { env } from '../env.generated';
import { routes } from './app.routes';

const oktaAuth = new OktaAuth({
  issuer: env.issuer,
  clientId: env.clientId,
  redirectUri: new URL('login/callback', document.baseURI).href,
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
});

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideOktaAuth(withOktaConfig({ oktaAuth }))],
};
