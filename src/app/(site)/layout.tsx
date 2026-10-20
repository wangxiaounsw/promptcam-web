import LoginDialog from '@/components/LoginDialog';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <LoginDialog />
    </>
  );
}
