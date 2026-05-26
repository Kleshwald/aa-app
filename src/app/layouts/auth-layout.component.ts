import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <router-outlet />
    </div>
  `,
})
export class AuthLayoutComponent {}
