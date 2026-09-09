import { provideRouter } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideToastr(), provideHttpClient(), provideNoopAnimations()],
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'contacts' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('contacts');
  });

  // ⚠️ Este caso afirmaba `<h1>Hello, contacts</h1>` —el template por defecto que `ng new` genera— y
  // **la app no tiene ningún `h1`**: su plantilla es solo un `<router-outlet>`. Llevaba tiempo siendo
  // falso y nadie lo veía, porque con Karma las pruebas no llegaban a correr: el contenedor no tiene
  // navegador. Migrar a Vitest lo destapó el primer día. Ahora comprueba lo que el componente hace.
  it('monta el router-outlet, que es todo lo que renderiza', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
