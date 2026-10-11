import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VSM Garcia | Gestão de Frota',
  description: 'Controle operacional e financeiro de frota pesada - CPK, Consumo Tanque Cheio, Fretes e Manutenção.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-800">{children}</body>
    </html>
  );
}
