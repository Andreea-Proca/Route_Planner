import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit {

  resetForm: FormGroup;

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    this.resetForm = new FormGroup({
      email: new FormControl('', Validators.required),
    });
  }

  sendResetLink() {
    if (this.resetForm.valid) {
      this.authService.ForgotPassword(this.resetForm.value.email);
    }
  }
}
