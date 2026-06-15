import { DOCUMENT } from '@angular/common';
import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';

const WIDGET_SRC = 'https://agentacademy.polis.online/widget_mortgage_v2.min.js';

@Component({
  selector: 'app-mortgage-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Виджет — сторонний web-component <polis-online-widget-mortgage>; схема разрешает неизвестный тег.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './mortgage.page.html',
  styleUrl: './mortgage.page.scss',
})
export class MortgagePage implements AfterViewInit {
  private readonly doc = inject(DOCUMENT);

  ngAfterViewInit(): void {
    // Скрипт polis.online регистрирует кастом-элемент и монтируется в него.
    // Грузим один раз на приложение; при повторном заходе элемент апгрейдится сам.
    if (this.doc.querySelector(`script[src="${WIDGET_SRC}"]`)) return;
    const script = this.doc.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    this.doc.body.appendChild(script);
  }
}
