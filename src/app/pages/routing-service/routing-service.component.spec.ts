import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutingServiceComponent } from './routing-service.component';

describe('RoutingServiceComponent', () => {
  let component: RoutingServiceComponent;
  let fixture: ComponentFixture<RoutingServiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RoutingServiceComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutingServiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
