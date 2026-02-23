import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaglioPannelli } from './taglio-pannelli';

describe('TaglioPannelli', () => {
  let component: TaglioPannelli;
  let fixture: ComponentFixture<TaglioPannelli>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaglioPannelli]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaglioPannelli);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
