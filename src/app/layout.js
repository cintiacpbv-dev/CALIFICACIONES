import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: {
    default: 'Letalidad térmica F0 / FH',
    template: '%s · Letalidad térmica',
  },
  description:
    'Cálculo de letalidad térmica (F0 / FH) para estudios de penetración de calor: hoja de datos tipo planilla, corrección por calibración de 2-3 puntos, criterios de aceptación e informe exportable.',
  applicationName: 'Letalidad térmica F0/FH',
  icons: {
    // SVG inline: evita un request más y se ve nítido en cualquier densidad.
    icon: [
      {
        url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23008300'/%3E%3Ctext x='32' y='44' font-family='system-ui,sans-serif' font-size='30' font-weight='700' fill='%23fff' text-anchor='middle'%3EF0%3C/text%3E%3C/svg%3E",
        type: 'image/svg+xml',
      },
    ],
  },
};

export const viewport = {
  themeColor: '#008300',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
