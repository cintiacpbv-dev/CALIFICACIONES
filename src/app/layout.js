import './globals.css';

export const metadata = {
  title: 'Letalidad Térmica F0/FH',
  description: 'Cálculo de letalidad térmica (F0/FH) con hoja de datos interactiva',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
