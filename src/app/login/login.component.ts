// src/app/login/login.component.ts
import { Component } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div>
      <h2>Login</h2>
      <form (ngSubmit)="login()">
        <label>Email:</label>
        <input type="email" [(ngModel)]="email" required />
        <br />
        <label>Password:</label>
        <input type="password" [(ngModel)]="password" required />
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  `,
})
export class LoginComponent {
  email: string = '';
  password: string = '';

  constructor(private authService: AuthService) {}

  login() {
    this.authService.login(this.email, this.password).then(() => {
      // Redirect or perform any other action upon successful login
    });
  }
}
