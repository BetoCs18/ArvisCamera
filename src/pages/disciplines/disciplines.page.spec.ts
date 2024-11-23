import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisciplinesPage } from './disciplines.page';

describe('DisciplinesPage', () => {
  let component: DisciplinesPage;
  let fixture: ComponentFixture<DisciplinesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DisciplinesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
