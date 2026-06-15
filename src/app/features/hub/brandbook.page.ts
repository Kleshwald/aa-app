import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Swatch {
  token: string;
  hex: string;
}
interface ColorGroup {
  title: string;
  swatches: Swatch[];
}
interface TypeSize {
  token: string;
  label: string;
}

@Component({
  selector: 'app-hub-brandbook-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brandbook.page.html',
  styleUrl: './brandbook.page.scss',
})
export class BrandbookPage {
  protected readonly colorGroups: ColorGroup[] = [
    {
      title: 'Бренд (navy)',
      swatches: [
        { token: '--brand-50', hex: '#eff4f9' },
        { token: '--brand-100', hex: '#dbe6f0' },
        { token: '--brand-300', hex: '#93b3d1' },
        { token: '--brand-500', hex: '#0c3363' },
        { token: '--brand-600', hex: '#0a2a52' },
        { token: '--brand-700', hex: '#082848' },
      ],
    },
    {
      title: 'Шапка',
      swatches: [
        { token: '--header-bg', hex: '#1d4e8c' },
        { token: '--header-bg-hover', hex: '#16447e' },
      ],
    },
    {
      title: 'Акцент (голубой)',
      swatches: [
        { token: '--accent-300', hex: '#87bdee' },
        { token: '--accent-500', hex: '#3992e4' },
        { token: '--accent-600', hex: '#236192' },
        { token: '--accent-700', hex: '#1b4d75' },
      ],
    },
    {
      title: 'Семантика',
      swatches: [
        { token: '--success-600', hex: '#16a34a' },
        { token: '--warning-600', hex: '#d97706' },
        { token: '--error-600', hex: '#dc2626' },
        { token: '--info-600', hex: '#236192' },
      ],
    },
    {
      title: 'Серые',
      swatches: [
        { token: '--gray-50', hex: '#f9fafb' },
        { token: '--gray-100', hex: '#f3f4f6' },
        { token: '--gray-200', hex: '#e5e7eb' },
        { token: '--gray-300', hex: '#d1d5db' },
        { token: '--gray-500', hex: '#6b7280' },
        { token: '--gray-700', hex: '#374151' },
        { token: '--gray-900', hex: '#111827' },
      ],
    },
  ];

  protected readonly typeSizes: TypeSize[] = [
    { token: '--text-2xl', label: '2XL — крупные заголовки' },
    { token: '--text-xl', label: 'XL — заголовки разделов' },
    { token: '--text-lg', label: 'LG — подзаголовки' },
    { token: '--text-base', label: 'Base — основной текст (18px)' },
    { token: '--text-sm', label: 'SM — вторичный текст' },
    { token: '--text-xs', label: 'XS — подписи, бейджи' },
  ];
}
