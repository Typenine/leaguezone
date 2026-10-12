import NotificationPreferences from '@/components/pwa/NotificationPreferences';
export const metadata={title:'Notification Settings | LeagueZone',robots:{index:false}};
export default function Page(){return <main className="container mx-auto max-w-4xl px-4 py-10"><h1 className="text-3xl font-bold">Notification Settings</h1><NotificationPreferences/></main>}
