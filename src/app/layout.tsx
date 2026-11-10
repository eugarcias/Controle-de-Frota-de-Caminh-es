import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallAppBanner } from '@/components/InstallAppBanner';

export const metadata: Metadata = {
  title: 'VSM Garcia | Gestão de Frota',
  description: 'Controle operacional e financeiro de frota pesada - CPK, Média Mensal de Consumo, Fretes e Manutenção.',
  manifest: '/manifest.webmanifest',
  applicationName: 'VSM Frota',
  appleWebApp: { capable: true, title: 'VSM Frota', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

// viewportFit 'cover' libera env(safe-area-inset-*) para o menu inferior não ficar sob a barra do iPhone
export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-800">
        <InstallAppBanner />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
