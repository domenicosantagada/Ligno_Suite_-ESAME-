import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rubrica } from './rubrica';

describe('Rubrica', () => {
  let component: Rubrica;
  let fixture: ComponentFixture<Rubrica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rubrica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Rubrica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
