import MobileAppTabs from '@/components/layout/MobileAppTabs';
import './app-tabs.css';
export default function Template({children}:{children:React.ReactNode}) { return <><div className="lz-content-wrap">{children}</div><MobileAppTabs/></>; }
