'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useRef, useCallback } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getTeamLogoPath } from '@/lib/utils/team-utils';
import { getTeamColors } from '@/lib/constants/team-colors';
import DraftPickAnimation from '@/components/draft-overlay/DraftPickAnimation';
import NowOnClockAnimation from '@/components/draft-overlay/NowOnClockAnimation';
import DraftTradeCenter from '@/components/draft-overlay/DraftTradeCenter';
import DraftTradeAnimation, { type TradeAnimAsset } from '@/components/draft-overlay/DraftTradeAnimation';
import DraftInfoBarTicker from '@/components/draft-overlay/DraftInfoBarTicker';
import RoundRecapOverlay from '@/components/draft-overlay/RoundRecapOverlay';
import {
  draftPicksPerRound,
  DRAFT_ANIM_CLOCK_PHASE_MAX_MS,
  DRAFT_ANIM_PICK_PHASE_MAX_MS,
} from '@/components/draft-overlay/draft-display-utils';
import { gsap } from 'gsap';
import { QueueListIcon } from '@heroicons/react/24/outline';

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    let videoId: string | null = null;
    if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split(/[?&]/)[0] || null;
    else if (url.includes('youtube.com')) { const u = new URL(url); videoId = u.searchParams.get('v') || u.pathname.split('/').pop() || null; }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
  } catch { return null; }
}

const POS_COLORS: Record<string, string> = {
  QB: '#C00000', RB: '#FFC000', WR: '#0070C0', TE: '#00B050', K: '#FF8C42', DEF: '#6b7280',
};

type DraftPick = { overall: number; round: number; team: string; playerId: string; playerName?: string | null; playerPos?: string | null; playerNfl?: string | null; madeAt: string };
type DraftSlot = { overall: number; round: number; team: string };

type DraftOverview = {
  id: string;
  year: number;
  rounds: number;
  clockSeconds: number;
  status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  curOverall: number;
  onClockTeam?: string | null;
  deadlineTs?: string | null;
  eventName?: string | null;
  eventLogoUrl?: string | null;
  eventColor1?: string | null;
  eventColor2?: string | null;
  recentPicks: DraftPick[];
  allPicks?: DraftPick[];
  upcoming: DraftSlot[];
  allSlots?: DraftSlot[];
  roundEndPause?: boolean | null;
  pendingTradeAnimation?: {
    teams: string[];
    assets: TradeAnimAsset[];
    resumeAfterAnimation?: boolean;
    triggerPickAnimation?: boolean;
    newClockTeam?: string | null;
  } | null;
};

type PendingPick = {
  id: string; overall: number; team: string; playerId: string;
  playerName: string | null; playerPos: string | null; playerNfl: string | null;
} | null;

type MeResp = { authenticated: boolean; isAdmin?: boolean; claims?: { team?: string } };
type Avail = { id: string; name: string; pos: string; nfl: string; college?: string | null };
type QueueItem = { id: string; name: string; pos: string; nfl: string };
type RosterPlayer = { id: string; name: string; pos: string; nfl: string };

export default function DraftRoomPage() {
  const [me, setMe] = useState<MeResp>({ authenticated: false });
  const [draft, setDraft] = useState<DraftOverview | null>(null);
  const [draftTeams, setDraftTeams] = useState<string[]>([]);
  const [pendingPick, setPendingPick] = useState<PendingPick>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [avail, setAvail] = useState<Avail[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [pickStatus, setPickStatus] = useState<null | 'pending' | 'rejected'>(null);
  const [submittedPlayer, setSubmittedPlayer] = useState<Avail | null>(null);
  const [autoPickEnabled, setAutoPickEnabled] = useState(false);
  const [adminTeamOverride, setAdminTeamOverride] = useState<string>('');
  const [rosterPosFilter, setRosterPosFilter] = useState<string>('ALL');
  const [tradeAnimData, setTradeAnimData] = useState<{
    teams: string[];
    assets: TradeAnimAsset[];
    resumeAfterAnimation?: boolean;
    triggerPickAnimation?: boolean;
    newClockTeam?: string | null;
  } | null>(null);
  const tradeAnimSeenIdRef = useRef<string | null>(null);
  const preTradeClockTeamRef = useRef<string | null>(null);
  const [teamRoster, setTeamRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [confirmPlayer, setConfirmPlayer] = useState<Avail | null>(null);
  const [teamPanelTab, setTeamPanelTab] = useState<'pick' | 'queue' | 'roster' | 'trade'>('pick');
  const [pickAnimCollege, setPickAnimCollege] = useState<string | undefined>(undefined);
  const usingCustomPoolRef = useRef(false);
  const [usingCustomPool, setUsingCustomPool] = useState(false);
  const [tradeInboxCount, setTradeInboxCount] = useState(0);
  const [tradeNotif, setTradeNotif] = useState(false);
  const prevTradeInboxCountRef = useRef(0);
  const tradeTabVisibleRef = useRef(false);
  tradeTabVisibleRef.current = teamPanelTab === 'trade';

  const [animPhase, setAnimPhase] = useState<'pick' | 'clock' | 'video' | null>(null);
  const [videoExiting, setVideoExiting] = useState(false);
  const animDataRef = useRef<{
    pick: DraftPick; nextTeamName: string | null; overall: number;
    round: number; pickInRound: number; videoUrl: string | null; imageUrl: string | null;
  } | null>(null);
  const animPlayerVideosRef = useRef<Record<string, { videoUrl: string | null; hasImage: boolean }>>({});
  const animLastPickRef = useRef<number | null>(null);
  const animInitRef = useRef(false);
  const animDismissingRef = useRef(false);
  const animVideoContainerRef = useRef<HTMLDivElement>(null);
  const animStartTimeRef = useRef<number>(0);
  const clockPhaseFinishedRef = useRef(false);
  const pendingGridAnimRef = useRef<{ idx: number; team: string } | null>(null);
  const finishClockIntroAfterAnimRef = useRef<() => Promise<void>>(async () => {});
  const roomClockRef = useRef<HTMLDivElement>(null);
  const prevAnimPhaseForClockHudRoomRef = useRef<'pick' | 'clock' | 'video' | null>(null);
  const [postIntroClockRoomSeq, setPostIntroClockRoomSeq] = useState(0);
  const [clockHudRoomTeamPrimary, setClockHudRoomTeamPrimary] = useState(false);

  const prevPendingRef = useRef<PendingPick>(null);
  const beepPlayedRef = useRef(false);
  const autoPickFiredRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const submitPickRef = useRef<(player: Avail) => Promise<void>>(async () => {});
  const myTeamRef = useRef<string | null>(null);
  const isFirstSearch = useRef(true);
  const prevCurOverallRef = useRef<number | null>(null);
  const searchRef = useRef(search);
  const posFilterRef = useRef(posFilter);
  searchRef.current = search;
  posFilterRef.current = posFilter;

  const isAdmin = !!me?.isAdmin;
  const onClock = draft?.onClockTeam || null;
  const myTeam = me?.claims?.team || (isAdmin ? (adminTeamOverride || onClock || null) : null);
  const isMyTurn = !!myTeam && !!onClock && myTeam === onClock;
  myTeamRef.current = myTeam;

  function dismissVideo() {
    if (animDismissingRef.current) return;
    animDismissingRef.current = true;
    if (animVideoContainerRef.current) gsap.killTweensOf(animVideoContainerRef.current);
    setVideoExiting(true);
    setTimeout(() => { setAnimPhase(null); setVideoExiting(false); animDismissingRef.current = false; }, 350);
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch { /* not supported */ }
  }, []);

  function getDraftPollMs(status: DraftOverview['status'] | null | undefined): number {
    if (status === 'LIVE') return 3000;
    if (status === 'PAUSED' || status === 'NOT_STARTED') return 8000;
    if (status === 'COMPLETED') return 12000;
    return 5000;
  }

  const submitPick = useCallback(async (player: Avail) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'pick', playerId: player.id, playerName: player.name, playerPos: player.pos, playerNfl: player.nfl }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) {
        const msg = j?.error === 'pick_submit_failed'
          ? 'Could not submit pick (server error). Please try again or contact the commissioner.'
          : (j?.error || 'Pick failed');
        alert(msg);
        return;
      }
      setPickStatus('pending');
      setSubmittedPlayer(player);
      setSearch('');
      setAvail(prev => prev.filter(p => p.id !== player.id));
    } finally {
      setSubmitting(false);
    }
  }, []);
  submitPickRef.current = submitPick;

  async function load(includeAvail = false, silent = false) {
    try {
      if (!silent) setLoading(true);
      const url = includeAvail ? '/api/draft?include=available' : '/api/draft';
      const res = await fetch(url, { cache: 'no-store' });
      const j = await res.json();
      const newDraft = j?.draft || null;
      const newPending: PendingPick = j?.pendingPick ?? null;
      const newRemaining = j?.remainingSec ?? null;
      setDraft(newDraft);
      setRemainingSec(newRemaining);
      setLocalRemaining(newRemaining);
      setLastFetchTime(Date.now());
      if (newDraft?.pendingTradeAnimation) {
        const animKey = JSON.stringify(newDraft.pendingTradeAnimation.teams) + (newDraft.pendingTradeAnimation.assets?.length ?? 0);
        if (tradeAnimSeenIdRef.current !== animKey) {
          tradeAnimSeenIdRef.current = animKey;
          preTradeClockTeamRef.current = newDraft.onClockTeam ?? null;
          setTradeAnimData(newDraft.pendingTradeAnimation);
        }
      }
      const newCurOverall = newDraft?.curOverall ?? null;
      if (newCurOverall !== null && prevCurOverallRef.current !== null && newCurOverall !== prevCurOverallRef.current) {
        fetch('/api/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'available', q: searchRef.current, pos: posFilterRef.current, limit: 50 }),
        }).then(r => r.json()).then(j2 => setAvail((j2?.available as Avail[]) || [])).catch(() => {});
      }
      prevCurOverallRef.current = newCurOverall;
      const prevPending = prevPendingRef.current;
      if (prevPending && prevPending.team === myTeamRef.current && !newPending) {
        const picks: DraftPick[] = newDraft?.allPicks || newDraft?.recentPicks || [];
        if (picks.some(p => p.playerId === prevPending.playerId)) {
          setPickStatus(null); setSubmittedPlayer(null);
        } else {
          setPickStatus('rejected');
          fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'available', q: searchRef.current, pos: posFilterRef.current, limit: 50 }) })
            .then(r => r.json()).then(j2 => setAvail((j2?.available as Avail[]) || [])).catch(() => {});
        }
      }
      prevPendingRef.current = newPending;
      setPendingPick(newPending);
      if (prevPending && prevPending.team === myTeamRef.current && !newPending) {
        const wasApproved = (newDraft?.allPicks || newDraft?.recentPicks || []).some((p: DraftPick) => p.playerId === prevPending.playerId);
        if (wasApproved && queueRef.current.some(q => q.id === prevPending.playerId)) {
          const cleaned = queueRef.current.filter(q => q.id !== prevPending.playerId);
          setQueue(cleaned);
          queueRef.current = cleaned;
          const qBody: Record<string, unknown> = { action: 'queue_set', players: cleaned };
          if (myTeamRef.current) qBody.team = myTeamRef.current;
          fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(qBody) }).catch(() => {});
        }
      }
      if (queueRef.current.length > 0) {
        const pickedIds = new Set((newDraft?.allPicks || newDraft?.recentPicks || []).map((p: DraftPick) => p.playerId));
        const filtered = queueRef.current.filter(q => !pickedIds.has(q.id));
        if (filtered.length !== queueRef.current.length) {
          setQueue(filtered);
          queueRef.current = filtered;
          const qBody: Record<string, unknown> = { action: 'queue_set', players: filtered };
          if (myTeamRef.current) qBody.team = myTeamRef.current;
          fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(qBody) }).catch(() => {});
        }
      }
      if (newRemaining !== null && newRemaining > 10) beepPlayedRef.current = false;
      if (includeAvail) {
        setAvail((j?.available as Avail[]) || []);
        const uc = Boolean(j?.usingCustom);
        usingCustomPoolRef.current = uc;
        setUsingCustomPool(uc);
      }
    } finally {
      setLoading(false);
    }
  }

  finishClockIntroAfterAnimRef.current = async () => {
    if (clockPhaseFinishedRef.current) return;
    clockPhaseFinishedRef.current = true;
    try {
      await load(false, true);
    } catch { /* ignore */ }
    setAnimPhase(!!(animDataRef.current?.videoUrl) ? 'video' : null);
  };

  const syncQueue = async (newQueue: QueueItem[]) => {
    setQueue(newQueue);
    queueRef.current = newQueue;
    const body: Record<string, unknown> = { action: 'queue_set', players: newQueue };
    if (isAdmin && myTeam) body.team = myTeam;
    await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  };
  const addToQueue = async (player: Avail) => {
    if (queue.some(q => q.id === player.id)) return;
    await syncQueue([...queue, player]);
  };
  const removeFromQueue = async (id: string) => syncQueue(queue.filter(q => q.id !== id));
  const moveInQueue = async (id: string, dir: 'up' | 'down') => {
    const idx = queue.findIndex(q => q.id === id);
    if (idx < 0) return;
    const nIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (nIdx < 0 || nIdx >= queue.length) return;
    const nq = [...queue];
    [nq[idx], nq[nIdx]] = [nq[nIdx], nq[idx]];
    await syncQueue(nq);
  };

  useEffect(() => {
    if (!myTeam) { setAutoPickEnabled(false); return; }
    try {
      const stored = localStorage.getItem(`lz_draft_autopick_${draft?.id || 'draft'}_${myTeam}`);
      setAutoPickEnabled(stored === 'true');
    } catch {}
  }, [myTeam, draft?.id]);

  useEffect(() => {
    if (!myTeam) { setTeamRoster([]); return; }
    setRosterLoading(true);
    fetch(`/api/draft/team-roster?team=${encodeURIComponent(myTeam)}`)
      .then(r => r.json())
      .then(j => setTeamRoster((j?.players as RosterPlayer[]) || []))
      .catch(() => setTeamRoster([]))
      .finally(() => setRosterLoading(false));
  }, [myTeam]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((j: MeResp) => setMe(j)).catch(() => {});
    fetch('/api/draft/teams', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setDraftTeams(Array.isArray(j?.teams) ? j.teams.filter((team: unknown): team is string => typeof team === 'string' && team.trim().length > 0) : []))
      .catch(() => setDraftTeams([]));
    load(true);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    const jitter = () => Math.floor(Math.random() * 400);
    const start = () => {
      const ms = (document.hidden ? 10000 : getDraftPollMs(draft?.status)) + jitter();
      t = setInterval(() => load(false, true), ms);
    };
    const onVis = () => {
      clearInterval(t);
      load(false, true);
      start();
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [draft?.status]);

  useEffect(() => {
    if (!myTeam) { setQueue([]); queueRef.current = []; return; }
    const body: Record<string, unknown> = { action: 'queue_get' };
    if (isAdmin) body.team = myTeam;
    fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json()).then(j => { const q = (j?.queue as QueueItem[]) || []; setQueue(q); queueRef.current = q; })
      .catch(() => {});
  }, [myTeam, isAdmin]);

  useEffect(() => {
    if (isFirstSearch.current) { isFirstSearch.current = false; return; }
    const t = setTimeout(async () => {
      const res = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'available', q: search, pos: posFilter, limit: 50 }) });
      const j = await res.json();
      setAvail((j?.available as Avail[]) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, posFilter]);

  useEffect(() => {
    if (remainingSec === null) return;
    if (draft?.status !== 'LIVE') {
      setLocalRemaining(remainingSec);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastFetchTime) / 1000);
      const newLocal = Math.max(0, remainingSec - elapsed);
      setLocalRemaining(newLocal);
      if (
        animPhase !== 'clock' &&
        animPhase !== 'pick' &&
        newLocal <= 10 &&
        newLocal > 0 &&
        !beepPlayedRef.current &&
        isMyTurn
      ) {
        beepPlayedRef.current = true; playBeep();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSec, lastFetchTime, isMyTurn, playBeep, draft?.status, animPhase]);

  useEffect(() => {
    const isMyPickPendingNow = pickStatus === 'pending' || (pendingPick?.team === myTeam);
    if (!isMyTurn || !autoPickEnabled || submitting || isMyPickPendingNow || animPhase === 'clock' || animPhase === 'pick') {
      autoPickFiredRef.current = false;
      return;
    }
    if (localRemaining !== null && localRemaining <= 0 && !autoPickFiredRef.current && queueRef.current.length > 0) {
      autoPickFiredRef.current = true;
      (async () => {
        for (const qp of queueRef.current) {
          try {
            const res = await fetch('/api/draft', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'pick', playerId: qp.id, playerName: qp.name, playerPos: qp.pos, playerNfl: qp.nfl }),
            });
            const j = await res.json();
            if (res.ok && !j?.error) {
              setPickStatus('pending');
              setSubmittedPlayer(qp);
              break;
            }
            if (j?.error === 'player_already_picked') continue;
            break;
          } catch { break; }
        }
      })();
    }
  }, [localRemaining, isMyTurn, autoPickEnabled, submitting, pickStatus, pendingPick, myTeam, animPhase]);

  useEffect(() => {
    async function loadVideos() {
      try {
        const res = await fetch('/api/draft/player-videos', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const map: Record<string, { videoUrl: string | null; hasImage: boolean }> = {};
        for (const v of (j.videos || [])) { map[v.playerId] = { videoUrl: v.videoUrl || null, hasImage: !!v.hasImage }; }
        animPlayerVideosRef.current = map;
      } catch {}
    }
    loadVideos();
    const t = setInterval(loadVideos, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const lastPick = draft?.recentPicks?.length ? draft.recentPicks[draft.recentPicks.length - 1] : null;
    if (!lastPick) {
      if (!animInitRef.current && draft !== null) animInitRef.current = true;
      animLastPickRef.current = null;
      return;
    }
    if (!animInitRef.current) {
      animInitRef.current = true;
      animLastPickRef.current = lastPick.overall;
      return;
    }
    if (lastPick.overall <= (animLastPickRef.current ?? -1)) return;
    animLastPickRef.current = lastPick.overall;
    if (document.hidden) return;

    void (async () => {
      try {
        const res = await fetch('/api/draft/player-videos', { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          const map: Record<string, { videoUrl: string | null; hasImage: boolean }> = {};
          for (const v of (j.videos || [])) {
            map[v.playerId] = { videoUrl: v.videoUrl || null, hasImage: !!v.hasImage };
          }
          animPlayerVideosRef.current = map;
        }
      } catch {}

      animDataRef.current = {
        pick: lastPick,
        nextTeamName: draft?.onClockTeam || draft?.upcoming?.[0]?.team || null,
        overall: lastPick.overall,
        round: lastPick.round,
        pickInRound: ((lastPick.overall - 1) % picksPerRound) + 1,
        videoUrl: animPlayerVideosRef.current[lastPick.playerId]?.videoUrl || null,
        imageUrl: animPlayerVideosRef.current[lastPick.playerId]?.hasImage
          ? `/api/draft/player-image?playerId=${encodeURIComponent(lastPick.playerId)}`
          : null,
      };
      const w = window as Window & { __pickAudioAt?: number };
      if (!w.__pickAudioAt || Date.now() - w.__pickAudioAt > 3000) {
        try { w.__pickAudioAt = Date.now(); new Audio('/assets/teams/audio/pickIsIn.mp3').play().catch(() => {}); } catch {}
      }
      animStartTimeRef.current = Date.now();
      setPickAnimCollege(undefined);
      setAnimPhase('pick');
      pendingGridAnimRef.current = { idx: lastPick.overall - 1, team: lastPick.team };
      const pmIdx = lastPick.overall - 1;
      requestAnimationFrame(() => {
        const pmCell = document.querySelector(`[data-grid-idx="${pmIdx}"]`) as HTMLElement | null;
        if (pmCell && !pmCell.querySelector('.gsap-pick-premask')) {
          const pm = document.createElement('div');
          pm.className = 'gsap-pick-premask';
          pm.style.cssText = 'position:absolute;inset:0;background:#0d0d12;z-index:9;pointer-events:none;';
          pmCell.appendChild(pm);
        }
      });
      const pid = lastPick.playerId;
      if (usingCustomPoolRef.current) {
        const fromList = avail.find(a => a.id === pid);
        if (fromList?.college) setPickAnimCollege(fromList.college);
      } else {
        fetch(`/api/draft?action=player_info&playerId=${encodeURIComponent(pid)}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => { if (data?.college) setPickAnimCollege(data.college); })
          .catch(() => {});
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.recentPicks?.[draft?.recentPicks?.length - 1]?.overall]);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) return;
      load(false);
      setAnimPhase(prev => {
        if (!prev) return prev;
        const elapsed = Date.now() - animStartTimeRef.current;
        if (elapsed > 35000) return null;
        return prev;
      });
      gsap.ticker.lagSmoothing(0);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (animPhase === 'clock') clockPhaseFinishedRef.current = false;
  }, [animPhase]);

  useEffect(() => {
    if (animPhase !== null) return;
    const pending = pendingGridAnimRef.current;
    if (!pending) return;
    pendingGridAnimRef.current = null;
    const cell = document.querySelector(`[data-grid-idx="${pending.idx}"]`) as HTMLElement | null;
    if (!cell) return;
    const teamColor = getTeamColors(pending.team).primary || '#888';
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:absolute;inset:0;background:${teamColor};transform:scaleX(0);transform-origin:left center;z-index:10;pointer-events:none;`;
    cell.appendChild(overlay);
    const tl = gsap.timeline({ delay: 0.8, onComplete: () => overlay.remove() });
    tl.to(overlay, { scaleX: 1, duration: 0.55, ease: 'power2.inOut', force3D: true });
    tl.call(() => { cell.querySelector('.gsap-pick-premask')?.remove(); });
    tl.to({}, { duration: 0.3 });
    tl.to(overlay, { scaleX: 0, transformOrigin: 'right center', duration: 0.45, ease: 'power2.in', force3D: true });
  }, [animPhase]);

  useEffect(() => {
    if (animPhase === 'pick') {
      const t = setTimeout(() => setAnimPhase('clock'), DRAFT_ANIM_PICK_PHASE_MAX_MS);
      return () => clearTimeout(t);
    }
    if (animPhase === 'clock') {
      const t = setTimeout(() => { void finishClockIntroAfterAnimRef.current(); }, DRAFT_ANIM_CLOCK_PHASE_MAX_MS);
      return () => clearTimeout(t);
    }
  }, [animPhase]);

  useEffect(() => {
    if (animPhase !== 'clock') return;
    if (!animDataRef.current?.nextTeamName) {
      void finishClockIntroAfterAnimRef.current();
    }
  }, [animPhase]);

  useEffect(() => {
    if (animPhase !== 'video') return;
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const ytState =
          data?.event === 'onStateChange' ? data?.info :
          data?.event === 'infoDelivery' && typeof data?.info?.playerState === 'number' ? data.info.playerState :
          undefined;
        if (ytState === 0) dismissVideo();
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [animPhase]);

  useEffect(() => {
    if (!myTeam || !draft?.id) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/draft/trade?action=get_team&team=${encodeURIComponent(myTeam)}&draftId=${draft.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const trades = (data.trades || []) as Array<{ status: string; teams: string[]; acceptedBy: string[] }>;
        const count = trades.filter(t => t.status === 'pending' && t.teams.includes(myTeam) && !t.acceptedBy.includes(myTeam)).length;
        setTradeInboxCount(count);
        if (count > prevTradeInboxCountRef.current && !tradeTabVisibleRef.current) {
          setTradeNotif(true);
        }
        prevTradeInboxCountRef.current = count;
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [myTeam, draft?.id]);

  useEffect(() => {
    if (animPhase !== 'video') return;
    animDismissingRef.current = false;
    if (animVideoContainerRef.current) {
      gsap.fromTo(animVideoContainerRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' });
    }
    const safetyTimer = setTimeout(dismissVideo, 10 * 60 * 1000);
    return () => clearTimeout(safetyTimer);
  }, [animPhase]);

  const onClockColors = onClock ? getTeamColors(onClock) : null;
  const tc = onClockColors ? [onClockColors.primary, onClockColors.secondary] : ['#1a1a2e', '#16213e'];
  const onClockLogo = onClock ? getTeamLogoPath(onClock) : null;
  const allSlots = draft?.allSlots || [];
  const allPicks = draft?.allPicks || draft?.recentPicks || [];
  const pickedByOverall = new Map(allPicks.map(p => [p.overall, p]));
  const rounds = draft?.rounds || 4;
  const picksPerRound = draftPicksPerRound(draft);
  const fallbackTeams = Array.from(new Set(allSlots.map(slot => slot.team).filter(Boolean)));
  const leagueTeams = draftTeams.length > 0 ? draftTeams : fallbackTeams;
  const myTeamColors = myTeam ? getTeamColors(myTeam) : null;
  const isMyPickPending = pickStatus === 'pending' || (pendingPick?.team === myTeam);
  const eventColor1 = draft?.eventColor1 || '#a4c810';
  const eventLogoUrl = draft?.eventLogoUrl || null;
  const eventGlow = `0 0 10px ${eventColor1}66`;
  const showRoundRecap = draft?.roundEndPause === true && animPhase === null && !tradeAnimData;
  const completedRound = draft?.allPicks && draft.allPicks.length > 0 ? draft.allPicks[draft.allPicks.length - 1].round : 0;
  const nextRoundNumber = completedRound + 1;
  const roundRecapPicks = draft?.allPicks?.filter(p => p.round === completedRound) || [];
  const fullClockSecRoom = draft?.clockSeconds ?? 600;
  const displayRemainingSecRoom = animPhase === 'clock' && draft?.status === 'LIVE' ? fullClockSecRoom : localRemaining;

  useEffect(() => {
    const prev = prevAnimPhaseForClockHudRoomRef.current;
    prevAnimPhaseForClockHudRoomRef.current = animPhase;
    if (prev === 'clock' && animPhase === null) {
      setClockHudRoomTeamPrimary(false);
      setPostIntroClockRoomSeq((n) => n + 1);
    }
  }, [animPhase]);

  useEffect(() => {
    if (postIntroClockRoomSeq === 0) return;
    const el = roomClockRef.current;
    let tween: gsap.core.Tween | null = null;
    const t1 = setTimeout(() => {
      setClockHudRoomTeamPrimary(true);
      if (el) {
        tween = gsap.fromTo(
          el,
          { scale: 1 },
          {
            scale: 1.08,
            duration: 0.28,
            yoyo: true,
            repeat: 3,
            ease: 'power2.inOut',
            onComplete: () => {
              if (el) gsap.set(el, { clearProps: 'scale' });
            },
          },
        );
      }
    }, 1000);
    return () => {
      clearTimeout(t1);
      tween?.kill();
      if (el) gsap.killTweensOf(el);
    };
  }, [postIntroClockRoomSeq]);

  useEffect(() => {
    if (displayRemainingSecRoom === null) return;
    if (displayRemainingSecRoom < fullClockSecRoom) setClockHudRoomTeamPrimary(false);
  }, [displayRemainingSecRoom, fullClockSecRoom]);

  useEffect(() => {
    if (animPhase === 'clock') return;
    if (roomClockRef.current && displayRemainingSecRoom !== null && displayRemainingSecRoom <= 10 && displayRemainingSecRoom > 0) {
      gsap.to(roomClockRef.current, {
        scale: 1.05,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
      });
    }
  }, [displayRemainingSecRoom, animPhase]);

  const roomClockDigitColor =
    displayRemainingSecRoom === null ? eventColor1
    : displayRemainingSecRoom <= 10 ? '#ef4444'
    : clockHudRoomTeamPrimary && displayRemainingSecRoom >= fullClockSecRoom ? tc[0]
    : eventColor1;

  return (
    <div className="flex flex-col" style={{ background: 'var(--background)' }}>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2" style={{ background: '#be161e', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {myTeam && myTeamColors && (
            <div className="w-8 h-8 shrink-0 rounded overflow-hidden bg-black/30">
              <img src={getTeamLogoPath(myTeam)} alt={myTeam} className="w-full h-full object-contain" />
            </div>
          )}
          <span className="min-w-0 truncate font-black text-white text-base sm:text-lg tracking-tight">
            Draft Room{myTeam ? ` — ${myTeam}` : ''}
          </span>
          {isAdmin && <span className="shrink-0 text-xs bg-yellow-400 text-black font-bold px-2 py-0.5 rounded">ADMIN MODE</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {draft && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${draft.status === 'LIVE' ? 'bg-emerald-500 text-white' : draft.status === 'PAUSED' ? 'bg-yellow-400 text-black' : 'bg-zinc-600 text-white'}`}>
              {draft.status}
            </span>
          )}
          {myTeam && draft && (
            <button type="button" onClick={() => setTeamPanelTab('trade')} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors" style={{ background: eventColor1, color: '#000' }}>
              🤝 Trade
            </button>
          )}
          <span className="text-white/70 text-xs">{draft ? `${draft.year} Draft` : 'No active draft'}</span>
        </div>
      </div>

      <div className="relative border-b-2 border-zinc-700" style={{ background: '#0a0a0e' }}>
        {eventLogoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
            <img src={eventLogoUrl} alt="" className="w-48 h-48 object-contain" style={{ opacity: 0.10 }} />
          </div>
        )}
        <div className="grid shrink-0 border-b border-zinc-800" style={{ gridTemplateColumns: `40px repeat(${rounds}, 1fr)`, background: '#111116' }}>
          <div className="text-center text-[10px] font-bold text-zinc-500 py-1.5" style={{ borderBottom: `2px solid ${eventColor1}` }}>#</div>
          {Array.from({ length: rounds }, (_, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-zinc-400 py-1.5 border-l border-zinc-800" style={{ borderBottom: `2px solid ${eventColor1}` }}>Round {i + 1}</div>
          ))}
        </div>
        <div>
          {Array.from({ length: picksPerRound }, (_, pickIdx) => (
            <div key={pickIdx} className="grid border-b border-zinc-800/50 hover:bg-zinc-900/30" style={{ gridTemplateColumns: `40px repeat(${rounds}, 1fr)`, minHeight: '36px' }}>
              <div className={`flex items-center justify-center text-xs font-bold border-r border-zinc-800 ${draft && (draft.curOverall - 1) % picksPerRound === pickIdx && draft.status === 'LIVE' ? 'text-yellow-400 bg-yellow-400/10 animate-pulse' : 'text-zinc-600'}`}>
                {pickIdx + 1}
              </div>
              {Array.from({ length: rounds }, (_, roundIdx) => {
                const overall = roundIdx * picksPerRound + pickIdx + 1;
                const slot = allSlots.find(s => s.overall === overall);
                const picked = pickedByOverall.get(overall);
                const isCurrent = draft?.curOverall === overall;
                const isMySlot = slot?.team === myTeam;
                const slotLogo = slot ? getTeamLogoPath(slot.team) : null;
                const posColor = picked?.playerPos ? (POS_COLORS[picked.playerPos] || '#888') : null;
                return (
                  <div key={roundIdx} data-grid-idx={overall - 1} className={`relative flex items-center gap-1 px-1.5 overflow-hidden ${isCurrent ? 'bg-yellow-400/15 ring-1 ring-inset ring-yellow-400' : picked ? 'bg-zinc-800/60' : isMySlot ? 'bg-blue-900/25' : ''}`} style={{ borderLeft: picked && posColor ? `3px solid ${posColor}` : '1px solid rgba(63,63,70,0.4)' }}>
                    {slotLogo && <div className="shrink-0 w-5 h-5"><img src={slotLogo} alt="" className="w-full h-full object-contain" /></div>}
                    {picked ? (
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-[10px] font-semibold leading-tight truncate">{picked.playerName || picked.playerId}</div>
                        <div className="text-zinc-400 text-[9px] leading-tight">{picked.playerPos}</div>
                      </div>
                    ) : isCurrent ? (
                      <div className="text-yellow-400 text-[9px] font-bold uppercase tracking-wide animate-pulse">On Clock</div>
                    ) : isMySlot ? (
                      <div className="text-blue-400 text-[9px]">My pick</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {(animPhase === 'video' || videoExiting) && animDataRef.current?.videoUrl && (() => {
          const videoUrl = animDataRef.current!.videoUrl!;
          const isYt = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
          const embedUrl = isYt ? getYoutubeEmbedUrl(videoUrl) : null;
          return (
            <div ref={animVideoContainerRef} className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center overflow-hidden transition-opacity duration-[350ms]" style={{ opacity: videoExiting ? 0 : 1 }}>
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                {embedUrl ? (
                  <iframe src={embedUrl} className="w-full flex-1 rounded-lg" allow="autoplay; fullscreen" allowFullScreen style={{ minHeight: 0 }} onLoad={(e) => {
                    try { (e.currentTarget as HTMLIFrameElement).contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch {}
                  }} />
                ) : (
                  <video src={videoUrl} autoPlay controls className="w-full flex-1 rounded-lg" style={{ minHeight: 0, objectFit: 'contain' }} onEnded={dismissVideo} />
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {showRoundRecap && draft && (
        <div className="px-4 pt-4">
          <RoundRecapOverlay key={`room-recap-${completedRound}`} roundNumber={completedRound} nextRound={nextRoundNumber} picks={roundRecapPicks} draftId={draft.id} isAdmin={false} eventLogoUrl={eventLogoUrl} eventColor1={eventColor1} variant="inline" onStartNextRound={() => {
            fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resume' }) }).catch(() => {});
          }} />
        </div>
      )}

      <div>
        {draft && (() => {
          const overall = pendingPick?.overall ?? draft.curOverall;
          const roundNum = Math.ceil(overall / picksPerRound);
          const pickNum = ((overall - 1) % picksPerRound) + 1;
          const nextUp = allSlots.filter((u: DraftSlot) => u.overall > overall && u.team !== onClock).slice(0, 2);
          return (
            <div className="relative flex flex-col sm:flex-row gap-0 items-stretch" style={{ minHeight: '184px', borderBottom: `2px solid ${eventColor1}33` }}>
              <div className="flex w-full sm:w-[380px] items-stretch shrink-0" style={{ background: '#202020', borderRadius: '4px', border: '1px solid #333' }}>
                <div className="flex flex-col justify-center items-center p-2 w-24 sm:w-28">
                  {eventLogoUrl && <img src={eventLogoUrl} alt="" className="object-contain" style={{ width: '88px', height: '88px', opacity: 0.94 }} />}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                  <div ref={roomClockRef} className={`text-3xl font-bold font-mono ${displayRemainingSecRoom !== null && displayRemainingSecRoom <= 10 ? 'text-red-500' : ''}`} style={{ color: roomClockDigitColor, textShadow: displayRemainingSecRoom !== null && displayRemainingSecRoom <= 10 ? undefined : eventGlow }}>
                    {displayRemainingSecRoom !== null ? formatTime(displayRemainingSecRoom) : '--:--'}
                  </div>
                  <div className="text-xs text-center font-bold" style={{ color: eventColor1 }}>RD {roundNum} · PK {pickNum}</div>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 p-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-700 rounded overflow-hidden border-2 shrink-0" style={{ borderColor: eventColor1, boxShadow: `0 0 10px ${eventColor1}66` }}>
                    {onClockLogo && <img src={onClockLogo} alt={onClock || ''} className="w-full h-full object-contain" />}
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-zinc-400 uppercase tracking-wide">Next</span>
                    <div className="flex gap-1.5">
                      {nextUp.map((t: DraftSlot, i: number) => (
                        <div key={i} className="w-9 h-9 bg-zinc-600 rounded overflow-hidden">
                          <img src={getTeamLogoPath(t.team)} alt={t.team} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block shrink-0 self-stretch" style={{ width: '8px', background: tc[1], boxShadow: `0 0 10px ${tc[1]}66` }} />
              <div className="min-h-[140px] flex-1 p-2 overflow-hidden relative" style={{ background: `${tc[0]}dd` }}>
                <DraftInfoBarTicker draftId={draft?.id ?? null} picksPerRound={picksPerRound} onClockTeam={onClock} available={avail} recentPicks={draft?.recentPicks} curOverall={draft?.curOverall} pendingPick={!!pendingPick} usingCustom={usingCustomPool} />
              </div>
              {animPhase === 'clock' && animDataRef.current?.nextTeamName && (() => {
                const teamName = animDataRef.current!.nextTeamName!;
                const colors = getTeamColors(teamName);
                const curOverall = animDataRef.current!.overall + 1;
                const ppr = picksPerRound;
                return (
                  <NowOnClockAnimation key={`room-clock-${animDataRef.current!.overall}`} layout="infoBar" team={{ name: teamName, colors: [colors.primary, colors.secondary, null] }} pickNumber={curOverall} round={Math.floor((curOverall - 1) / ppr) + 1} pickInRound={((curOverall - 1) % ppr) + 1} eventName={draft?.eventName} eventYear={draft?.year} eventLogoUrl={draft?.eventLogoUrl} eventColor1={draft?.eventColor1} onComplete={() => { void finishClockIntroAfterAnimRef.current(); }} />
                );
              })()}
            </div>
          );
        })()}

        <div className="p-3 space-y-3">
          {isMyPickPending && (
            <div className="p-3 rounded-lg border-2 border-yellow-400 bg-yellow-400/10">
              <div className="font-bold text-sm text-yellow-600 dark:text-yellow-300">⏳ Pick Submitted — Awaiting Admin Approval</div>
              {submittedPlayer && <div className="text-xs mt-1 text-yellow-700 dark:text-yellow-200/80">{submittedPlayer.name} · {submittedPlayer.pos} · {submittedPlayer.nfl}</div>}
              <div className="text-xs mt-1 text-yellow-600/70 dark:text-yellow-400/60">Your pick will appear on the board once approved.</div>
            </div>
          )}
          {pickStatus === 'rejected' && (
            <div className="p-3 rounded-lg border-2 border-red-500 bg-red-500/10">
              <div className="font-bold text-sm text-red-600 dark:text-red-400">❌ Pick Rejected — Please try again.</div>
              <button type="button" className="mt-1 text-xs underline text-red-500 hover:text-red-400" onClick={() => { setPickStatus(null); setSubmittedPlayer(null); }}>Dismiss</button>
            </div>
          )}
          {!me.authenticated && !isAdmin && !loading && (
            <div className="p-3 rounded-lg border border-[var(--border)] text-[var(--muted)] text-sm">Log in with your team credentials to make picks.</div>
          )}

          {isAdmin && !me.authenticated && (
            <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30 space-y-2">
              <div className="font-bold text-yellow-700 dark:text-yellow-300 text-xs uppercase tracking-wide">Admin mode — view as team</div>
              <select value={adminTeamOverride} onChange={e => setAdminTeamOverride(e.target.value)} className="w-full px-2 py-1.5 rounded border border-yellow-400/40 text-sm" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
                <option value="">{onClock ? `Auto (on clock: ${onClock})` : 'Auto (on clock)'}</option>
                {leagueTeams.map(t => <option key={t} value={t}>{t}{t === onClock ? ' ⏰' : ''}</option>)}
              </select>
              {myTeam && <div className="text-xs text-yellow-700 dark:text-yellow-300/70">{myTeam === onClock ? '✅ On the clock — pick panel is open' : `Viewing as ${myTeam} — picks unlock when it's their turn`}</div>}
            </div>
          )}

          {(me.authenticated || isAdmin) && (
            <div className="rounded-xl overflow-hidden border-2 shadow-md flex flex-col min-h-0" style={{ borderColor: myTeamColors?.secondary ?? 'var(--border)', background: myTeamColors ? `${myTeamColors.primary}12` : 'var(--background)' }}>
              {myTeam && (
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border)]/80">
                  <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden border-2 bg-black/40 flex items-center justify-center" style={{ borderColor: myTeamColors?.secondary ?? 'var(--border)' }}>
                    <img src={getTeamLogoPath(myTeam)} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-sm text-[var(--foreground)] break-words leading-tight">{myTeam}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Pick · Queue · Roster · Trade</div>
                  </div>
                </div>
              )}
              <div className="flex gap-1 px-2 py-2 border-b border-[var(--border)] bg-black/5 dark:bg-white/5 flex-wrap">
                {(['pick', 'queue', 'roster', 'trade'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => { setTeamPanelTab(tab); if (tab === 'trade') setTradeNotif(false); }} className="flex-1 min-w-[4.5rem] py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-colors" style={teamPanelTab === tab ? { background: myTeamColors?.primary ?? '#be161e', color: '#fff', boxShadow: `0 0 0 1px ${myTeamColors?.secondary ?? 'transparent'}` } : { background: 'transparent', color: 'var(--muted)' }}>
                    {tab === 'pick' ? 'Pick' : tab === 'queue' ? `Queue${queue.length ? ` (${queue.length})` : ''}` : tab === 'trade' ? `Trade${tradeInboxCount > 0 ? ` (${tradeInboxCount})` : ''}` : 'Roster'}
                  </button>
                ))}
              </div>
              <div className={`p-3 space-y-3 flex-1 flex flex-col min-h-0 ${teamPanelTab === 'trade' ? 'min-h-[340px]' : ''}`}>
                {teamPanelTab === 'pick' && (
                  <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]">
                    <div className="px-3 pt-3 pb-2 border-b border-[var(--border)]">
                      <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">{isMyTurn && !isMyPickPending ? 'Make your pick' : 'Browse players'}</div>
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {(['', ...POSITIONS] as string[]).map(pos => {
                          const active = posFilter === pos;
                          return <button key={pos || 'all'} type="button" onClick={() => setPosFilter(pos)} className="px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors" style={active ? { background: pos ? POS_COLORS[pos] : '#555', color: '#fff', borderColor: 'transparent' } : { background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}>{pos || 'All'}</button>;
                        })}
                      </div>
                      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player name…" className="w-full" />
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                      {avail.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-[var(--muted)]">{loading ? 'Loading…' : 'No results — try a search or change position filter.'}</div>
                      ) : avail.map(p => {
                        const inQueue = queue.some(q => q.id === p.id);
                        const canPick = isMyTurn && !isMyPickPending;
                        return (
                          <div key={p.id} className="flex items-start gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                            <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded text-white mt-0.5" style={{ background: POS_COLORS[p.pos] || '#555', minWidth: '30px', textAlign: 'center' }}>{p.pos}</span>
                            <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-[var(--foreground)] break-words leading-snug">{p.name}</div><div className="text-xs text-[var(--muted)]">{p.nfl}</div></div>
                            <div className="flex gap-1.5 shrink-0 self-center items-center">
                              {canPick && myTeamColors && <button type="button" disabled={submitting} onClick={() => setConfirmPlayer(p)} className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide text-white shadow-sm disabled:opacity-50 transition-transform active:scale-[0.98]" style={{ background: myTeamColors.primary, boxShadow: `0 0 0 1px ${myTeamColors.secondary}66` }}>Pick</button>}
                              {canPick && !myTeamColors && <Button size="sm" variant="primary" disabled={submitting} onClick={() => setConfirmPlayer(p)}>Pick</Button>}
                              <button type="button" onClick={() => (inQueue ? removeFromQueue(p.id) : addToQueue(p))} title={inQueue ? 'Remove from queue' : 'Add to draft queue'} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors" style={inQueue ? { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' } : myTeamColors ? { borderColor: `${myTeamColors.secondary}aa`, color: myTeamColors.primary, background: `${myTeamColors.primary}12` } : { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'transparent' }}><QueueListIcon className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />{inQueue ? 'Queued' : 'Queue'}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {teamPanelTab === 'queue' && (
                  <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                      <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">My queue {queue.length > 0 && <span className="text-[var(--foreground)]">({queue.length})</span>}</div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-[var(--muted)]">Instant auto-pick</span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${autoPickEnabled ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} onClick={() => {
                          const next = !autoPickEnabled;
                          setAutoPickEnabled(next);
                          try { localStorage.setItem(`lz_draft_autopick_${draft?.id || 'draft'}_${myTeam || 'default'}`, String(next)); } catch {}
                        }}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPickEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </label>
                    </div>
                    <div className="px-3 py-1.5 text-xs text-[var(--muted)] border-b border-[var(--border)]">{autoPickEnabled ? <span className="font-medium text-emerald-700 dark:text-emerald-400">Instant — top queued player submitted when time expires</span> : <span>Top queued player is sent to admin when time expires (within ~3s)</span>}</div>
                    {queue.length === 0 ? <div className="px-3 py-3 text-xs text-[var(--muted)]">Queue is empty — use <span className="font-semibold text-[var(--foreground)]">Queue</span> on the Pick tab.</div> : (
                      <ul className="divide-y divide-[var(--border)]">
                        {queue.map((q, idx) => (
                          <li key={q.id} className={`flex items-start gap-2 px-3 py-2 ${idx === 0 && autoPickEnabled ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                            <span className="text-xs font-bold text-[var(--muted)] w-4 shrink-0 tabular-nums pt-0.5">{idx + 1}</span>
                            <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded text-white mt-0.5" style={{ background: POS_COLORS[q.pos] || '#555', minWidth: '30px', textAlign: 'center' }}>{q.pos}</span>
                            <span className="flex-1 min-w-0 text-sm font-semibold text-[var(--foreground)] break-words leading-snug">{q.name}</span>
                            {idx === 0 && autoPickEnabled && <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 uppercase pt-0.5">AUTO</span>}
                            <div className="flex shrink-0 self-center"><button type="button" disabled={idx === 0} onClick={() => moveInQueue(q.id, 'up')} className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700">↑</button><button type="button" disabled={idx === queue.length - 1} onClick={() => moveInQueue(q.id, 'down')} className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-20 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700">↓</button><button type="button" onClick={() => removeFromQueue(q.id)} className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-red-500 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700">×</button></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {teamPanelTab === 'roster' && (
                  <>
                    {myTeam && draft && (() => {
                      const myPicks = allPicks.filter(p => p.team === myTeam);
                      return <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]"><div className="px-3 py-2 text-xs font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)]">My draft picks — {myTeam}</div>{myPicks.length === 0 ? <div className="px-3 py-3 text-xs text-[var(--muted)]">No picks yet this draft.</div> : <ul className="divide-y divide-[var(--border)]">{myPicks.map(p => <li key={p.overall} className="flex items-start gap-2 px-3 py-2"><span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded text-white mt-0.5" style={{ background: POS_COLORS[p.playerPos || ''] || '#555', minWidth: '30px', textAlign: 'center' }}>{p.playerPos || '?'}</span><span className="flex-1 min-w-0 text-sm font-semibold text-[var(--foreground)] break-words leading-snug">{p.playerName || p.playerId}</span><span className="text-xs text-[var(--muted)] shrink-0 pt-0.5">R{p.round}.{((p.overall - 1) % picksPerRound) + 1}</span></li>)}</ul>}</div>;
                    })()}
                    {myTeam && draft && (() => {
                      const myUp = allSlots.filter(s => s.team === myTeam && s.overall >= draft.curOverall);
                      return <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]"><div className="px-3 py-2 text-xs font-bold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)]">My upcoming picks</div>{myUp.length === 0 ? <div className="px-3 py-3 text-xs text-[var(--muted)]">No more picks.</div> : <div className="flex flex-wrap gap-2 p-3">{myUp.map(u => <span key={u.overall} className="text-xs px-2.5 py-1 rounded-lg font-semibold border" style={{ color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}>Pick #{u.overall} · R{u.round}</span>)}</div>}</div>;
                    })()}
                    {myTeam && (
                      <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                          <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide min-w-0 break-words">Current roster — {myTeam}</span>
                          <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                            {(['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const).map(p => <button key={p} type="button" onClick={() => setRosterPosFilter(p)} className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors" style={rosterPosFilter === p ? { background: p === 'ALL' ? (myTeamColors?.primary || '#555') : (POS_COLORS[p] || '#555'), color: '#fff', borderColor: 'transparent' } : { background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}>{p}</button>)}
                          </div>
                        </div>
                        {rosterLoading ? <div className="px-3 py-3 text-xs text-[var(--muted)]">Loading roster…</div> : teamRoster.length === 0 ? <div className="px-3 py-3 text-xs text-[var(--muted)]">No roster data found.</div> : (
                          <ul className="divide-y divide-[var(--border)]">{[...teamRoster].filter(p => rosterPosFilter === 'ALL' || p.pos === rosterPosFilter).sort((a, b) => { const order: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 }; return (order[a.pos] ?? 9) - (order[b.pos] ?? 9) || a.name.localeCompare(b.name); }).map(p => <li key={p.id} className="flex items-start gap-2 px-3 py-2"><span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded text-white mt-0.5" style={{ background: POS_COLORS[p.pos] || '#555', minWidth: '30px', textAlign: 'center' }}>{p.pos || '?'}</span><span className="flex-1 min-w-0 text-sm font-semibold text-[var(--foreground)] break-words leading-snug">{p.name}</span><span className="text-xs text-[var(--muted)] shrink-0 pt-0.5">{p.nfl}</span></li>)}</ul>
                        )}
                      </div>
                    )}
                    {!myTeam && <div className="text-xs text-[var(--muted)] px-1 py-2">Select a team (log in or use admin view-as) to see roster and your picks.</div>}
                  </>
                )}

                {teamPanelTab === 'trade' && myTeam && draft && (
                  <div className="flex-1 flex flex-col min-h-0 -mx-1">
                    <DraftTradeCenter embedded myTeam={myTeam} allTeams={leagueTeams} draftId={draft.id} eventColor1={eventColor1} onClose={() => setTeamPanelTab('pick')} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="h-4" />
        </div>
      </div>

      {confirmPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setConfirmPlayer(null)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#18181b' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ background: myTeamColors ? myTeamColors.primary : '#be161e' }}><div className="text-base font-black text-white uppercase tracking-wide">Confirm Selection</div></div>
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-4"><span className="text-sm font-black px-2.5 py-1 rounded text-white" style={{ background: POS_COLORS[confirmPlayer.pos] || '#555' }}>{confirmPlayer.pos}</span><div><div className="text-lg font-black text-white">{confirmPlayer.name}</div><div className="text-sm text-zinc-400">{confirmPlayer.nfl}</div></div></div>
              <p className="text-sm text-zinc-300 mb-5">Are you sure you want to make this selection? It will be sent to the commissioner for approval.</p>
              <div className="flex gap-3"><button type="button" className="flex-1 py-2.5 rounded-lg text-sm font-bold border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors" onClick={() => setConfirmPlayer(null)}>Cancel</button><button type="button" disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-black text-white transition-colors disabled:opacity-50" style={{ background: myTeamColors ? myTeamColors.primary : '#be161e' }} onClick={() => { submitPick(confirmPlayer); setConfirmPlayer(null); }}>{submitting ? 'Submitting…' : 'Confirm Pick'}</button></div>
            </div>
          </div>
        </div>
      )}

      {animPhase === 'pick' && animDataRef.current && (animDataRef.current.pick.playerName || animDataRef.current.pick.playerId) && (
        <DraftPickAnimation key={`room-pick-${animDataRef.current.overall}`} player={{ name: animDataRef.current.pick.playerName || animDataRef.current.pick.playerId || 'Unknown', position: animDataRef.current.pick.playerPos || 'N/A', team: animDataRef.current.pick.playerNfl || undefined, college: pickAnimCollege, imageUrl: animDataRef.current.imageUrl || undefined }} fantasyTeam={{ name: animDataRef.current.pick.team, colors: [getTeamColors(animDataRef.current.pick.team).primary, getTeamColors(animDataRef.current.pick.team).secondary, null], logoPath: getTeamLogoPath(animDataRef.current.pick.team) }} pickNumber={animDataRef.current.overall} round={animDataRef.current.round} pickInRound={animDataRef.current.pickInRound} eventLogoUrl={draft?.eventLogoUrl} eventColor1={eventColor1} onComplete={() => setAnimPhase('clock')} />
      )}
      {tradeAnimData && (
        <DraftTradeAnimation key={`room-trade-${tradeAnimSeenIdRef.current}`} teams={tradeAnimData.teams} assets={tradeAnimData.assets} eventLogoUrl={draft?.eventLogoUrl} eventColor1={draft?.eventColor1} picksPerRound={picksPerRound} onComplete={() => {
          const captured = tradeAnimData;
          setTradeAnimData(null);
          if (captured?.resumeAfterAnimation && draft?.id) {
            fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resume' }) }).catch(() => {});
          }
          const currentClockTeam = draft?.onClockTeam ?? null;
          if (currentClockTeam && currentClockTeam !== preTradeClockTeamRef.current) {
            const curOv = draft?.curOverall ?? 1;
            const ppr = draftPicksPerRound(draft);
            animDataRef.current = { pick: { overall: curOv, team: currentClockTeam, playerId: '', playerName: null, playerPos: null, round: Math.ceil(curOv / ppr), pickInRound: ((curOv - 1) % ppr) + 1, madeAt: '' } as unknown as DraftPick, nextTeamName: currentClockTeam, overall: curOv - 1, round: Math.ceil(curOv / ppr), pickInRound: ((curOv - 1) % ppr) + 1, videoUrl: null, imageUrl: null };
            setAnimPhase('clock');
          }
          if (draft?.id) {
            fetch('/api/draft/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear_trade_animation', draftId: draft.id }) }).catch(() => {});
          }
        }} />
      )}

      {tradeNotif && teamPanelTab !== 'trade' && (
        <div className="fixed bottom-6 right-6 z-[9999] w-72 max-w-[calc(100vw-3rem)] rounded-xl border-2 bg-zinc-900 shadow-2xl p-4 cursor-pointer" style={{ borderColor: eventColor1, boxShadow: `0 0 24px ${eventColor1}55` }} onClick={() => { setTradeNotif(false); setTeamPanelTab('trade'); }}>
          <div className="font-black text-sm uppercase tracking-widest mb-1" style={{ color: eventColor1 }}>🤝 Trade Offer!</div>
          <div className="text-white text-sm mb-1">You have {tradeInboxCount} pending trade offer{tradeInboxCount !== 1 ? 's' : ''}.</div>
          <div className="text-xs text-zinc-400">Tap to open Trade Center →</div>
          <button onClick={e => { e.stopPropagation(); setTradeNotif(false); }} className="absolute top-2 right-2 text-zinc-500 hover:text-white text-lg w-6 h-6 flex items-center justify-center">×</button>
        </div>
      )}
    </div>
  );
}
