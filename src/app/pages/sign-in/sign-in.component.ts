import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "src/app/services/auth";

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnInit {

  signinForm: FormGroup;

  constructor(private router: Router, private authService: AuthService) {
  }

  ngOnInit(): void {
    document.body.classList.add('no-scroll');
    this.createSigninForm();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('no-scroll');
  }

  createSigninForm() {
    this.signinForm = new FormGroup({
      email: new FormControl('', Validators.required),
      password: new FormControl('', Validators.required)
    })
  }

  signin() {
    if (this.signinForm.valid) {
      this.authService.SignIn(this.signinForm.value.email, this.signinForm.value.password)
    }
  }
}
