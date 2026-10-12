import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/server/session';
import NotificationControls from '@/components/pwa/NotificationControls';

export const metadata={
  title:'Notifications | LeagueZone',
  description:'Manage LeagueZone notifications for watched player opportunity changes.',
};

export default async function NotificationSettingsPage(){
  const session=await requireUser();
  if(!session)redirect('/login?next=%2Fsettings%2Fnotifications');
  return <main className="mx-auto min-h-[75vh] max-w-3xl px-4 py-10 pb-28 text-[var(--text)]">
    <h1 className="text-3xl font-black uppercase tracking-tight">Notifications</h1>
    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Choose whether LeagueZone sends you alerts when watched players show meaningful changes in opportunity. Signals describe playing time and usage, not fantasy predictions.</p>
    <NotificationControls />
  </main>;
}
