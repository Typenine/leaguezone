import { redirect } from 'next/navigation';

export default function LegacySetupAdminPage() {
  redirect('/setup/auth');
}
