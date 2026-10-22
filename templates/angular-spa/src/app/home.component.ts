import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { OKTA_AUTH, OktaAuthStateService } from '@okta/okta-angular';
import { OktaAuth, UserClaims } from '@okta/okta-auth-js';
import { filter, from, Observable, switchMap } from 'rxjs';

@Component({
  selector: 'app-home',
  imports: [AsyncPipe, JsonPipe],
  template: `
    @if (authState$ | async; as state) {
      @if (state.error) {
        <div class="error">{{ state.error }}</div>
      } @else if (!state.isAuthenticated) {
        <p class="muted">You are signed out. Sign in to see the ID token claims.</p>
        <button class="btn" (click)="signIn()">Sign in with Okta</button>
      } @else {
        @let user = user$ | async;
        <div class="row">
          <span class="status"><span class="dot"></span> Signed in{{ user?.email ? ' as ' + user?.email : '' }}</span>
          <button class="btn secondary" (click)="signOut()">Sign out</button>
        </div>
        <pre>{{ user | json }}</pre>
      }
    } @else {
      <p class="muted">Loading…</p>
    }
  `,
})
export class HomeComponent {
  private oktaAuth = inject<OktaAuth>(OKTA_AUTH);
  private authState = inject(OktaAuthStateService);

  authState$ = this.authState.authState$;
  user$: Observable<UserClaims | null> = this.authState$.pipe(
    filter((s) => !!s.isAuthenticated),
    switchMap(() => from(this.oktaAuth.getUser())),
  );

  signIn() { return this.oktaAuth.signInWithRedirect(); }
  signOut() { return this.oktaAuth.signOut(); }
}
