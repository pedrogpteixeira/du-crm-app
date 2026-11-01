import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-portulogos-b2b-placeholder',
  standalone: true,
  template: `
    <section class="phase-placeholder">
      <h1>Portulogos B2B</h1>
      <p>
        A estrutura de acesso está ativa. A interface de contratos será ligada nas próximas fases.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .phase-placeholder {
      padding: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.35rem;
    }
    p {
      margin: 0;
      opacity: 0.72;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortulogosB2BPlaceholder {}
