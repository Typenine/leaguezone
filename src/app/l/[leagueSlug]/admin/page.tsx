import { createLeagueBridge } from '@/lib/server/league-bridge';

export const dynamic = 'force-dynamic';

// League settings is the commissioner surface today; a dedicated league admin
// dashboard will live here in a later pass.
export default createLeagueBridge('/settings');
