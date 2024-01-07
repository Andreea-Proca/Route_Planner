import { Component } from '@angular/core';
import { NavigationEnd, Event, Router } from '@angular/router';

interface ITab {
  name: string;
  link: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  tabs: ITab[] = [{
    name: 'Dashboard',
    link: '/dashboard'
  }, {
    name: 'Map',
    link: '/map'
  }, {
    name: 'Sign In',
    link: '/sign-in'
  }, {
    name: 'Sign Up',
    link: '/sign-up'
  }, {
    name: 'Reviews',
    link: '/review'
  }];

  activeTab = this.tabs[0].link;

  constructor(private router: Router) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        this.activeTab = event.url;
        console.log(event);
      }
    });
  }

  // See app.component.html
  mapLoadedEvent(status: boolean) {
    console.log('The map loaded: ' + status);
  }
}

