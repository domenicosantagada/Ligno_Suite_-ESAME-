import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Impostazioni } from './impostazioni';

describe('Impostazioni', () => {
  let component: Impostazioni;
  let fixture: ComponentFixture<Impostazioni>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Impostazioni]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Impostazioni);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
