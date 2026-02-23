import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Preventivi } from './preventivi';

describe('Preventivi', () => {
  let component: Preventivi;
  let fixture: ComponentFixture<Preventivi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Preventivi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Preventivi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
