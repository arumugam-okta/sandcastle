import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="shell">
      <div class="card">
        <span class="badge">@okta/okta-angular</span>
        <h1>Okta Angular SDK</h1>
        <router-outlet />
      </div>
    </div>
  `,
})
export class AppComponent {}
