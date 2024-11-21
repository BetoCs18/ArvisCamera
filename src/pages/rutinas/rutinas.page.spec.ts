import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RutinasPage } from './rutinas.page';

describe('RutinasPage', () => {
  let component: RutinasPage;
  let fixture: ComponentFixture<RutinasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RutinasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
