import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Prezzario } from './prezzario';

describe('Prezzario', () => {
  let component: Prezzario;
  let fixture: ComponentFixture<Prezzario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Prezzario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Prezzario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
