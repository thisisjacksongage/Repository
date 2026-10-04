import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  useGetDashboard, getGetDashboardQueryKey, useGetGoals, getGetGoalsQueryKey,
  useCreateGoal, useUpdateGoal, useDeleteGoal, useGetGoalContributions,
  getGetGoalContributionsQueryKey, useCreateGoalContribution, useDeleteContribution,
  useGetItems, getGetItemsQueryKey, useCreateItem, useUpdateItem, useDeleteItem,
  useGetBackup, getGetBackupQueryKey, useRestoreBackup, type BackupRestoreInput,
} from '@workspace/api-client-react';
import {
  ArrowDownLeft, ArrowRight, BadgeCheck, Banknote, Boxes, Check, CircleDollarSign, Coins,
  Download, LogOut, Menu, Pencil, Plus, ReceiptText, Search, ShoppingBag, Sprout, Tag, Trash2,
  TrendingUp, Wallet, X, Sparkles,
  Upload,
} from 'lucide-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#315843', colorForeground: '#263c32', colorMutedForeground: '#788378',
    colorDanger: '#a94f46', colorBackground: '#fbf9f2', colorInput: '#fffdf7',
    colorInputForeground: '#263c32', colorNeutral: '#ded9cb', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f2] rounded-[24px] w-[440px] max-w-full overflow-hidden border border-[#e5dfd1]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-[#263c32] text-[26px]',
    headerSubtitle: 'text-[#788378] text-[13px]',
    socialButtonsBlockButtonText: 'text-[#365744] font-semibold',
    formFieldLabel: 'text-[#47584b] font-semibold',
    footerActionLink: 'text-[#315843] font-semibold',
    footerActionText: 'text-[#788378]',
    dividerText: 'text-[#879184]',
    identityPreviewEditButton: 'text-[#315843]',
    formFieldSuccessText: 'text-[#477555]',
    alertText: 'text-[#843f39]',
    logoBox: 'mb-2',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'rounded-xl border-[#ded9cb] bg-[#fffdf7]',
    formButtonPrimary: 'rounded-xl bg-[#315843] hover:bg-[#254b35] text-[#f7f1e3]',
    formFieldInput: 'rounded-xl border-[#ded9cb] bg-[#fffdf7] text-[#263c32]',
    footerAction: 'border-0',
    dividerLine: 'bg-[#e5dfd1]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#ded9cb]',
    formFieldRow: 'mb-4',
    main: 'px-1',
  },
};
const money = (amount?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount ?? 0);
const today = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
const dateLabel = (date?: string | null) => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date set';
const colors = ['#b9785d', '#557b65', '#7e8fbd', '#d1a94f', '#a06b92', '#5d9999'];

function Shell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const nav = [
    { href: '/dashboard', label: 'Overview', icon: Sprout },
    { href: '/goals', label: 'Savings goals', icon: Wallet },
    { href: '/inventory', label: 'Resale notebook', icon: ShoppingBag },
  ];
  return <div className="min-h-[100dvh] bg-[#f5f2e9] text-[#263c32] md:flex">
    <aside className={`${mobileNav ? 'flex' : 'hidden'} fixed inset-0 z-40 w-full flex-col bg-[#223d31] px-6 pb-6 pt-7 text-[#f6f0df] md:sticky md:top-0 md:flex md:h-[100dvh] md:w-[248px] md:shrink-0 md:px-5`}>
      <div className="mb-12 flex items-center justify-between md:mb-14">
        <Link href="/" className="flex items-center gap-3 text-[#fff9ec] no-underline" data-testid="link-brand">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#e3bb71] text-[#20392e]"><Coins size={21}/></span>
          <span><span className="block font-serif text-[22px] leading-6">MoneyTrack</span><span className="text-[10px] uppercase tracking-[.18em] text-[#b8c8b9]">your money, in motion</span></span>
        </Link>
        <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19}/></button>
      </div>
      <p className="mb-3 ml-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#99ad9d]">Your notebook</p>
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium no-underline transition-colors ${path === href ? 'bg-[#365744] text-[#ffdc97]' : 'text-[#d5dfd2] hover:bg-[#2d4a39]'}`}><Icon size={18} strokeWidth={1.8}/>{label}{path === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e5bd76]"/>}</Link>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-[#45604d] bg-[#2a4737] p-4">
        <div className="mb-2 flex items-center gap-2 text-[#e6c98d]"><ReceiptText size={15}/><span className="text-[11px] font-semibold uppercase tracking-[.12em]">A little reminder</span></div>
        <p className="mb-0 font-serif text-[17px] leading-[1.35] text-[#f3eddd]">The small wins are still wins.</p>
        <p className="mb-0 mt-2 text-[11px] leading-relaxed text-[#b4c4b3]">Every saved dollar and every thoughtful flip adds up.</p>
      </div>
      <div className="mt-5 flex items-center gap-3 px-1 text-[11px] text-[#c1cec1]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#496950] font-serif text-sm text-[#f8e7be]">{(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || 'M').toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate font-semibold text-[#f1ead9]">{user?.fullName || 'My money book'}</b><span className="block truncate">{user?.primaryEmailAddress?.emailAddress || 'Personal workspace'}</span></span><button onClick={()=>void signOut({redirectUrl:basePath||'/'})} aria-label="Sign out" title="Sign out" data-testid="button-sign-out" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#c1cec1] hover:bg-[#365744] hover:text-[#f8e7be]"><LogOut size={15}/></button></div>
    </aside>
    {mobileNav && <button className="fixed inset-0 z-30 bg-black/35 md:hidden" aria-label="Dismiss navigation" onClick={() => setMobileNav(false)}/>}
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5dfd1] bg-[#f7f4ec]/95 px-5 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 hover:bg-[#ebe6d9] md:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19}/></button>
          <div><p className="mb-0 text-[10px] font-semibold uppercase tracking-[.16em] text-[#8a9688]">Personal finance, thoughtfully</p><p className="mb-0 mt-0.5 font-serif text-[18px]">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p></div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#e5dfd1] bg-[#fbf9f2] px-3 py-2 text-[11px] text-[#738174] sm:flex"><span className="h-2 w-2 rounded-full bg-[#6e9875]"/><span>All caught up</span></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 md:px-10 md:pt-10">{children}</div>
    </main>
  </div>;
}

function PageHeading({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.19em] text-[#9b7758]">{kicker}</p><h1 className="mb-2 font-serif text-[34px] leading-tight tracking-[-.03em] text-[#263c32] md:text-[42px]">{title}</h1><p className="mb-0 max-w-xl text-[13px] leading-relaxed text-[#788378]">{text}</p></div>{action}</div>;
}
function ActionButton({ children, onClick, secondary = false, testId, type = 'button' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; testId?: string; type?: 'button' | 'submit' }) {
  return <button type={type} data-testid={testId} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-[11px] text-[12px] font-semibold transition-all duration-200 active:scale-[.98] ${secondary ? 'border border-[#dcd6c7] bg-[#fbf9f2] text-[#43584a] hover:border-[#aebca9] hover:bg-[#f0eee3]' : 'bg-[#315843] text-[#f7f1e3] shadow-[0_5px_12px_rgba(43,75,55,.12)] hover:bg-[#254b35]'}`}>{children}</button>;
}
function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`money-card rounded-[20px] border border-[#e5dfd1] bg-[#fbf9f2] ${className}`}>{children}</section>; }
function LoadingCards() { return <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(x => <div key={x} className="h-32 animate-pulse rounded-2xl bg-[#e9e5d8]"/>)}<div className="col-span-full h-64 animate-pulse rounded-2xl bg-[#e9e5d8]"/></div>; }
function ErrorMessage({ retry }: { retry: () => void }) { return <div className="rounded-2xl border border-[#e7c7bc] bg-[#fbf0e9] p-6 text-center"><p className="font-serif text-xl">Couldn’t open your notebook</p><p className="mt-1 text-sm text-[#7c716a]">Your data is still yours. Try loading it again.</p><button onClick={retry} className="mt-3 rounded-lg bg-[#315843] px-4 py-2 text-sm text-white">Try again</button></div>; }
function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center"><span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#eee9db] text-[#55745e]"><Sprout size={21}/></span><h3 className="mb-1 font-serif text-[20px]">{title}</h3><p className="mb-4 max-w-sm text-[12px] leading-relaxed text-[#7b877b]">{body}</p>{action}</div>; }
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#47584b]">{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-[#929a8e]">{hint}</span>}</label>; }
function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`w-full rounded-xl border border-[#ded9cb] bg-[#fffdf7] px-3 py-[10px] text-[12px] text-[#263c32] outline-none transition focus:border-[#78937a] focus:ring-2 focus:ring-[#78937a]/15 ${props.className ?? ''}`}/>; }
function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`w-full rounded-xl border border-[#ded9cb] bg-[#fffdf7] px-3 py-[10px] text-[12px] text-[#263c32] outline-none focus:border-[#78937a] ${props.className ?? ''}`}/>; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value.trim();
}
function requiredAmount(value: unknown, label: string, allowZero = false): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) throw new Error(`${label} must be a valid amount.`);
  return Math.round(amount * 100) / 100;
}
function optionalAmount(value: unknown, label: string): number | null {
  return value == null || value === '' ? null : requiredAmount(value, label, true);
}
function backupDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new Error('A backup date is invalid.');
  const date = value.slice(0, 10);
  if (new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) throw new Error('A backup date is invalid.');
  return date;
}
function normalizeBackup(value: unknown): { data: BackupRestoreInput; legacyTransactions: number } {
  if (!isRecord(value)) throw new Error('This file is not a MoneyTrack backup.');
  if (value.formatVersion === 2) {
    if (!Array.isArray(value.goals) || !Array.isArray(value.contributions) || !Array.isArray(value.items)) throw new Error('The backup is missing required data.');
    const goals = value.goals.map((raw) => {
      if (!isRecord(raw)) throw new Error('A goal in this backup is invalid.');
      return {
        sourceId: requiredText(raw.id, 'Goal ID'),
        name: requiredText(raw.name, 'Goal name'),
        targetAmount: requiredAmount(raw.targetAmount, 'Goal target'),
        targetDate: typeof raw.targetDate === 'string' ? backupDate(raw.targetDate) : null,
        color: typeof raw.color === 'string' ? raw.color : '#557b65',
      };
    });
    const contributions = value.contributions.map((raw) => {
      if (!isRecord(raw)) throw new Error('A contribution in this backup is invalid.');
      return {
        sourceGoalId: requiredText(raw.goalId, 'Contribution goal'),
        amount: requiredAmount(raw.amount, 'Contribution'),
        date: backupDate(raw.date),
        note: typeof raw.note === 'string' ? raw.note : null,
      };
    });
    const items = value.items.map((raw) => {
      if (!isRecord(raw)) throw new Error('A resale item in this backup is invalid.');
      if (!['inventory', 'listed', 'sold', 'returned'].includes(String(raw.status))) throw new Error('A resale item has an invalid status.');
      const status = raw.status as 'inventory' | 'listed' | 'sold' | 'returned';
      const optionalText = (entry: unknown) => typeof entry === 'string' ? entry : null;
      return {
        name: requiredText(raw.name, 'Item name'),
        category: optionalText(raw.category),
        brand: optionalText(raw.brand),
        size: optionalText(raw.size),
        status,
        purchasePrice: requiredAmount(raw.purchasePrice, 'Purchase price', true),
        purchaseDate: backupDate(raw.purchaseDate),
        listingPrice: optionalAmount(raw.listingPrice, 'Listing price'),
        soldPrice: optionalAmount(raw.soldPrice, 'Sale price'),
        platform: optionalText(raw.platform),
        platformFee: optionalAmount(raw.platformFee, 'Platform fee'),
        paymentFee: optionalAmount(raw.paymentFee, 'Payment fee'),
        shippingCost: optionalAmount(raw.shippingCost, 'Shipping cost'),
        otherCosts: optionalAmount(raw.otherCosts, 'Other costs'),
        soldDate: typeof raw.soldDate === 'string' ? backupDate(raw.soldDate) : null,
        notes: optionalText(raw.notes),
      };
    });
    return { data: { goals, contributions, items }, legacyTransactions: 0 };
  }

  // Import the original browser-only MoneyTrack backup format.
  if (Array.isArray(value.goals) && Array.isArray(value.depop)) {
    const oldGoals = value.goals.map((raw) => {
      if (!isRecord(raw)) throw new Error('A goal in this backup is invalid.');
      return {
        sourceId: String(raw.id ?? ''),
        name: requiredText(raw.name, 'Goal name'),
        targetAmount: requiredAmount(raw.target, 'Goal target'),
        savedAmount: requiredAmount(raw.amount ?? 0, 'Saved amount', true),
      };
    });
    const goals = oldGoals.map(({ sourceId, name, targetAmount }) => ({
      sourceId: requiredText(sourceId, 'Goal ID'),
      name,
      targetAmount,
      targetDate: null,
      color: '#557b65',
    }));
    const contributions = oldGoals
      .filter((goal) => goal.savedAmount > 0)
      .map((goal) => ({
        sourceGoalId: goal.sourceId,
        amount: goal.savedAmount,
        date: today(),
        note: 'Starting balance imported from the original MoneyTrack backup',
      }));
    const items = value.depop.map((raw) => {
      if (!isRecord(raw)) throw new Error('A Depop sale in this backup is invalid.');
      return {
        name: requiredText(raw.item, 'Item name'),
        category: null,
        brand: null,
        size: null,
        status: 'sold' as const,
        purchasePrice: requiredAmount(raw.cost ?? 0, 'Purchase price', true),
        purchaseDate: backupDate(raw.date),
        listingPrice: null,
        soldPrice: requiredAmount(raw.sale, 'Sale price'),
        platform: 'Depop',
        platformFee: requiredAmount(raw.fees ?? 0, 'Fees', true),
        paymentFee: null,
        shippingCost: null,
        otherCosts: null,
        soldDate: backupDate(raw.date),
        notes: typeof raw.source === 'string' ? `Source: ${raw.source}` : null,
      };
    });
    return {
      data: { goals, contributions, items },
      legacyTransactions: Array.isArray(value.transactions) ? value.transactions.length : 0,
    };
  }
  throw new Error('Unrecognized backup format. Choose a MoneyTrack JSON backup.');
}
function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d3027]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`max-h-[94dvh] w-full overflow-y-auto rounded-t-[24px] border border-[#e5dfd1] bg-[#f9f7ef] p-5 shadow-2xl sm:rounded-[24px] sm:p-7 ${wide ? 'max-w-[660px]' : 'max-w-[480px]'}`}><div className="mb-5 flex justify-between gap-3"><div><h2 className="mb-1 font-serif text-[25px]">{title}</h2>{subtitle && <p className="mb-0 text-[11px] text-[#778276]">{subtitle}</p>}</div><button aria-label="Close dialog" onClick={onClose} className="h-8 w-8 shrink-0 rounded-full text-[#6e796f] hover:bg-[#ece8dc]"><X size={17}/></button></div>{children}</div></div>;
}

function Overview() {
  const client = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const { data: goals = [] } = useGetGoals();
  const backupQuery = useGetBackup({ query: { enabled: false, queryKey: getGetBackupQueryKey() } });
  const restoreBackup = useRestoreBackup();
  const importFile = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  if (isLoading) return <div className="money-page"><PageHeading kicker="Your money, in motion" title="A good day to check in." text="A clear little look at what you’re saving and what your finds are earning."/><LoadingCards/></div>;
  if (isError || !data) return <ErrorMessage retry={() => { void refetch(); }}/>;
  const pct = data.savingsTarget > 0 ? Math.min(100, data.totalSaved / data.savingsTarget * 100) : 0;
  const maxProfit = Math.max(1, ...data.monthly.map(m => m.profit));
  const exportBackup = async () => {
    setBackupMessage('');
    try {
      const result = await backupQuery.refetch();
      if (!result.data) throw new Error('Could not load your backup.');
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `moneytrack-backup-${today()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupMessage('Your backup was downloaded.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Could not download your backup.');
    }
  };
  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    setBackupMessage('');
    setBackupBusy(true);
    try {
      const normalized = normalizeBackup(JSON.parse(await file.text()));
      const details = `${normalized.data.goals.length} goals, ${normalized.data.contributions.length} contributions, and ${normalized.data.items.length} resale items`;
      const legacyWarning = normalized.legacyTransactions
        ? `\n\nThe older backup also has ${normalized.legacyTransactions} general income/spending entries. This version imports savings goals and Depop sales, not those entries.`
        : '';
      if (!window.confirm(`Restore ${details}?\n\nThis replaces the data currently in this account.${legacyWarning}`)) return;
      restoreBackup.mutate({ data: normalized.data }, {
        onSuccess: (result) => {
          void client.invalidateQueries();
          setBackupMessage(`Restored ${result.goalsImported} goals, ${result.contributionsImported} contributions, and ${result.itemsImported} resale items.${normalized.legacyTransactions ? ` ${normalized.legacyTransactions} older income/spending entries were not imported.` : ''}`);
        },
        onError: (error) => setBackupMessage(error instanceof Error ? error.message : 'Could not restore this backup.'),
      });
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Could not read this backup.');
    } finally {
      setBackupBusy(false);
    }
  };
  return <div className="money-page">
    <PageHeading kicker="Your money, in motion" title="A good day to check in." text="A clear little look at what you’re saving and what your finds are earning."/>
    <Panel className="mb-5 overflow-hidden border-[#315843] bg-[#315843] text-[#f8f2e2]">
      <div className="relative grid gap-7 p-6 md:grid-cols-[1.15fr_.85fr] md:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border border-[#d5c793]/15"/><div className="absolute right-20 top-20 h-28 w-28 rounded-full border border-[#d5c793]/10"/>
        <div className="relative"><div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#c8d3bc]"><Wallet size={14}/> Savings at a glance</div><p className="mb-1 font-serif text-[42px] tracking-[-.04em] md:text-[52px]" data-testid="text-total-saved">{money(data.totalSaved)}</p><p className="mb-6 text-[12px] text-[#c9d5c7]">of {money(data.savingsTarget)} across {data.goalCount} {data.goalCount === 1 ? 'goal' : 'goals'}</p><div className="mb-2 h-[7px] overflow-hidden rounded-full bg-[#65806a]"><div className="progress-fill h-full rounded-full bg-[#e6c47d]" style={{ width: `${pct}%` }}/></div><div className="flex justify-between text-[10px] text-[#c4d0c1]"><span>{pct.toFixed(0)}% of your target</span><span>{money(Math.max(0, data.savingsTarget - data.totalSaved))} to go</span></div></div>
        <div className="relative grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><div className="mb-3 flex items-center gap-2 text-[#d5c58f]"><TrendingUp size={15}/><span className="text-[10px] uppercase tracking-[.1em]">All-time flips</span></div><p className="mb-1 font-serif text-[25px]">{money(data.resaleProfit)}</p><p className="mb-0 text-[10px] text-[#c6d1c5]">net resale profit</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><div className="mb-3 flex items-center gap-2 text-[#d5c58f]"><Banknote size={15}/><span className="text-[10px] uppercase tracking-[.1em]">This month</span></div><p className="mb-1 font-serif text-[25px]">{money(data.monthlyProfit)}</p><p className="mb-0 text-[10px] text-[#c6d1c5]">profit in your pocket</p></div>
          <div className="col-span-2 flex items-center justify-between rounded-2xl bg-[#e7ddbd] px-4 py-3 text-[#304738]"><span className="flex items-center gap-2 text-[11px] font-semibold"><Tag size={15}/> {data.activeListings} pieces out in the world</span><span className="text-[10px]">{data.itemsSold} sold so far</span></div>
        </div>
      </div>
    </Panel>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Panel className="p-5 md:p-6"><div className="mb-5 flex items-end justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b7758]">The longer view</p><h2 className="mb-0 font-serif text-[22px]">Resale rhythm</h2></div><div className="flex gap-4 text-[10px] text-[#788378]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#557b65]"/>Profit</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#dfc98f]"/>Sales</span></div></div>
        {data.monthly.length ? <div className="grid h-[190px] grid-flow-col auto-cols-fr items-end gap-2 border-b border-[#e6dfd0] px-1 pt-5">{data.monthly.slice(-8).map((month, i) => <div key={month.month} className="flex h-full flex-col items-center justify-end gap-2"><div className="flex h-[145px] w-full items-end justify-center gap-[3px]"><div className="w-[35%] min-w-[6px] rounded-t-[5px] bg-[#557b65] transition-all duration-500" title={`Profit ${money(month.profit)}`} style={{ height: `${Math.max(4, month.profit / maxProfit * 100)}%`, opacity: .62 + i * .04 }}/><div className="w-[35%] min-w-[6px] rounded-t-[5px] bg-[#dfc98f]" title={`Sales ${money(month.sales)}`} style={{ height: `${Math.max(4, month.sales / Math.max(1, ...data.monthly.map(m => m.sales)) * 100)}%` }}/></div><span className="pb-2 text-[9px] text-[#808a7d]">{month.label}</span></div>)}</div> : <EmptyState title="Your first flip is ahead" body="Once you record a sale, your month-by-month rhythm will appear here."/>}
        <div className="mt-4 flex justify-between text-[10px] text-[#879085]"><span>Each month: sales and take-home profit</span><Link href="/inventory" className="inline-flex items-center gap-1 font-semibold text-[#315843] no-underline">Open resale notebook <ArrowRight size={12}/></Link></div>
      </Panel>
      <Panel className="p-5 md:p-6"><div className="mb-4 flex items-end justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b7758]">Steady, small steps</p><h2 className="mb-0 font-serif text-[22px]">Your goals</h2></div><Link href="/goals" className="text-[11px] font-semibold text-[#315843] no-underline">All goals <ArrowRight className="ml-1 inline" size={12}/></Link></div>
        {goals.length ? <div className="space-y-4">{goals.slice(0, 4).map((goal, index) => { const percent = goal.targetAmount ? Math.min(100, goal.savedAmount / goal.targetAmount * 100) : 0; return <div key={goal.id} data-testid={`card-goal-${goal.id}`}><div className="mb-1.5 flex justify-between gap-2"><span className="truncate text-[12px] font-semibold">{goal.name}</span><span className="shrink-0 font-mono text-[10px] text-[#748074]">{money(goal.savedAmount)} <span className="text-[#a3aa9f]">/ {money(goal.targetAmount)}</span></span></div><div className="h-[6px] overflow-hidden rounded-full bg-[#eee9dc]"><div className="progress-fill h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: goal.color || colors[index % colors.length] }}/></div><div className="mt-1 text-right text-[9px] text-[#899287]">{goal.targetDate ? `Target ${dateLabel(goal.targetDate)}` : `${percent.toFixed(0)}% there`}</div></div>; })}</div> : <EmptyState title="Plant your first goal" body="Give your savings a name and somewhere to grow." action={<Link href="/goals" className="text-sm font-semibold text-[#315843] no-underline">Set up a goal <ArrowRight className="ml-1 inline" size={14}/></Link>}/>}
      </Panel>
    </div>
    <Panel className="mt-5 p-5 md:p-6"><div className="mb-4 flex items-end justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b7758]">The little things add up</p><h2 className="mb-0 font-serif text-[22px]">Recent activity</h2></div><span className="text-[10px] text-[#899287]">Your latest money moves</span></div>
      {data.recentActivity.length ? <div className="divide-y divide-[#ece6d9]">{data.recentActivity.slice(0, 7).map(activity => <div key={activity.id} data-testid={`activity-${activity.id}`} className="flex items-center gap-3 py-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${activity.amount >= 0 ? 'bg-[#e7eee2] text-[#4f7b5e]' : 'bg-[#f3e9dc] text-[#a06f4e]'}`}>{activity.type === 'sale' ? <ShoppingBag size={16}/> : activity.type === 'contribution' ? <ArrowDownLeft size={16}/> : activity.type === 'goal' ? <Wallet size={16}/> : <Tag size={16}/>}</span><div className="min-w-0 flex-1"><p className="mb-0 truncate text-[12px] font-semibold">{activity.title}</p><p className="mb-0 mt-0.5 truncate text-[10px] text-[#8a9488]">{activity.subtitle} · {dateLabel(activity.date)}</p></div><span className={`shrink-0 font-mono text-[12px] font-medium ${activity.amount >= 0 ? 'text-[#477555]' : 'text-[#8c5b45]'}`}>{activity.amount >= 0 ? '+' : ''}{money(activity.amount)}</span></div>)}</div> : <EmptyState title="A fresh page" body="Contributions, new finds and sales will show up here as they happen."/>}
    </Panel>
    <Panel className="mt-5 flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b7758]">Your data stays portable</p><h2 className="mb-1 font-serif text-[22px]">Back up your notebook</h2><p className="mb-0 max-w-xl text-[11px] leading-relaxed text-[#788378]">Download a JSON copy or restore one. Restoring replaces the goals, contributions, and resale items in this account.</p>
        {backupMessage && <p role="status" className="mb-0 mt-3 text-[11px] text-[#315843]">{backupMessage}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <input ref={importFile} type="file" accept=".json,application/json" className="hidden" onChange={event => { const file = event.currentTarget.files?.[0]; void importBackup(file); event.currentTarget.value = ''; }}/>
        <ActionButton secondary onClick={() => { void exportBackup(); }} testId="button-export-backup"><Download size={14}/>{backupQuery.isFetching ? 'Preparing…' : 'Export backup'}</ActionButton>
        <ActionButton onClick={() => importFile.current?.click()} testId="button-import-backup"><Upload size={14}/>{backupBusy || restoreBackup.isPending ? 'Restoring…' : 'Restore backup'}</ActionButton>
      </div>
    </Panel>
  </div>;
}

function GoalsPage() {
  const client = useQueryClient();
  const { data: goals = [], isLoading, isError, refetch } = useGetGoals();
  const create = useCreateGoal(); const update = useUpdateGoal(); const remove = useDeleteGoal();
  const addContribution = useCreateGoalContribution();
  const [goalModal, setGoalModal] = useState<{ mode: 'create' | 'edit'; goal?: typeof goals[number] } | null>(null);
  const [contributionGoal, setContributionGoal] = useState<typeof goals[number] | null>(null);
  const [editingContributions, setEditingContributions] = useState<string | null>(null);
  const complete = () => { void client.invalidateQueries({ queryKey: getGetGoalsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); };
  const sumTarget = goals.reduce((n,g)=>n+g.targetAmount,0); const sumSaved = goals.reduce((n,g)=>n+g.savedAmount,0);
  return <div className="money-page">
    <PageHeading kicker="A little at a time" title="Savings goals" text="Give the things you’re saving for a name, a number, and a place to grow." action={<ActionButton onClick={()=>setGoalModal({mode:'create'})} testId="button-add-goal"><Plus size={15}/> New goal</ActionButton>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><SummaryCard label="Set aside so far" value={money(sumSaved)} icon={<Wallet size={16}/>} detail="Across all your goals"/><SummaryCard label="Your combined target" value={money(sumTarget)} icon={<CircleDollarSign size={16}/>} detail={`${goals.length} ${goals.length === 1 ? 'goal' : 'goals'} in your book`}/><SummaryCard label="Still on the way" value={money(Math.max(0,sumTarget-sumSaved))} icon={<TrendingUp size={16}/>} detail={sumTarget ? `${Math.min(100,sumSaved/sumTarget*100).toFixed(0)}% of the way there` : 'Your next chapter'} /></div>
    {isLoading ? <LoadingCards/> : isError ? <ErrorMessage retry={()=>{void refetch();}}/> : goals.length ? <div className="grid gap-4 lg:grid-cols-2">{goals.map((goal,index)=><GoalCard key={goal.id} goal={goal} index={index} onEdit={()=>setGoalModal({mode:'edit',goal})} onDelete={()=>{if(window.confirm(`Delete “${goal.name}” and its contribution history?`)) remove.mutate({goalId:goal.id},{onSuccess:()=>{complete();void client.invalidateQueries({queryKey:getGetGoalContributionsQueryKey(goal.id)});}});}} onContribute={()=>setContributionGoal(goal)} onHistory={()=>setEditingContributions(goal.id)}/>)}</div> : <Panel><EmptyState title="Every good plan starts somewhere" body="Name the thing you’re saving for, then add to it whenever you can." action={<ActionButton onClick={()=>setGoalModal({mode:'create'})}><Plus size={14}/> Create your first goal</ActionButton>}/></Panel>}
    {goalModal && <GoalForm mode={goalModal.mode} goal={goalModal.goal} busy={create.isPending||update.isPending} onClose={()=>setGoalModal(null)} onSubmit={value=>{ if(goalModal.mode==='create') create.mutate({data:value},{onSuccess:()=>{complete();setGoalModal(null);}}); else if(goalModal.goal) update.mutate({goalId:goalModal.goal.id,data:value},{onSuccess:()=>{complete();setGoalModal(null);}}); }}/>}
    {contributionGoal && <ContributionForm goal={contributionGoal} busy={addContribution.isPending} onClose={()=>setContributionGoal(null)} onSubmit={value=>addContribution.mutate({goalId:contributionGoal.id,data:value},{onSuccess:()=>{complete();void client.invalidateQueries({queryKey:getGetGoalContributionsQueryKey(contributionGoal.id)});setContributionGoal(null);}})}/>}
    {editingContributions && <ContributionHistory goalId={editingContributions} goal={goals.find(g=>g.id===editingContributions)} onClose={()=>setEditingContributions(null)} onChanged={()=>{complete();void client.invalidateQueries({queryKey:getGetGoalContributionsQueryKey(editingContributions)});}}/>}
  </div>;
}
function SummaryCard({label,value,icon,detail}:{label:string;value:string;icon:ReactNode;detail:string}) { return <Panel className="p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#818c7f]">{label}</span><span className="text-[#9a815d]">{icon}</span></div><p className="mb-1 font-serif text-[26px]">{value}</p><p className="mb-0 text-[10px] text-[#929a8f]">{detail}</p></Panel>; }
function GoalCard({goal,index,onEdit,onDelete,onContribute,onHistory}:{goal:any;index:number;onEdit:()=>void;onDelete:()=>void;onContribute:()=>void;onHistory:()=>void}) {
  const pct=goal.targetAmount>0?Math.min(100,goal.savedAmount/goal.targetAmount*100):0; const shade=goal.color||colors[index%colors.length];
  return <Panel className="overflow-hidden p-5 md:p-6" ><div className="mb-4 flex items-start gap-3"><span className="mt-0.5 h-10 w-1.5 rounded-full" style={{backgroundColor:shade}}/><div className="min-w-0 flex-1"><h2 className="mb-1 truncate font-serif text-[22px]">{goal.name}</h2><p className="mb-0 text-[10px] text-[#849084]">{goal.targetDate?`Hoping for ${dateLabel(goal.targetDate)}`:'No target date'}</p></div><div className="flex gap-1"><IconButton label="Edit goal" onClick={onEdit}><Pencil size={14}/></IconButton><IconButton label="Delete goal" onClick={onDelete}><Trash2 size={14}/></IconButton></div></div>
    <div className="mb-2 flex items-end justify-between"><span className="font-serif text-[30px]">{money(goal.savedAmount)}</span><span className="pb-1 text-[11px] text-[#828d80]">of {money(goal.targetAmount)}</span></div><div className="h-[8px] overflow-hidden rounded-full bg-[#eee9dc]"><div className="progress-fill h-full rounded-full" style={{width:`${pct}%`,backgroundColor:shade}}/></div><div className="mt-2 flex justify-between text-[10px] text-[#879184]"><span>{pct.toFixed(0)}% there</span><span>{money(Math.max(0,goal.targetAmount-goal.savedAmount))} left</span></div>
    <div className="mt-5 flex flex-wrap gap-2"><ActionButton onClick={onContribute} testId={`button-contribute-${goal.id}`}><Plus size={14}/> Add money</ActionButton><ActionButton secondary onClick={onHistory} testId={`button-history-${goal.id}`}>Contribution history <ArrowRight size={13}/></ActionButton></div>
  </Panel>;
}
function IconButton({children,label,onClick}:{children:ReactNode;label:string;onClick:()=>void}) {return <button aria-label={label} title={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-[#839083] transition hover:bg-[#efebdf] hover:text-[#315843]">{children}</button>;}
function GoalForm({mode,goal,busy,onClose,onSubmit}:{mode:'create'|'edit';goal?:any;busy:boolean;onClose:()=>void;onSubmit:(value:{name:string;targetAmount:number;targetDate:string|null;color:string})=>void}) {
  const [name,setName]=useState(goal?.name??''); const [target,setTarget]=useState(goal?.targetAmount?String(goal.targetAmount):''); const [targetDate,setTargetDate]=useState(goal?.targetDate?.slice(0,10)??''); const [color,setColor]=useState(goal?.color||colors[1]);
  return <Modal title={mode==='create'?'Start a new goal':'Tend this goal'} subtitle="Give your savings plan a clear little shape." onClose={onClose}><form className="space-y-4" onSubmit={e=>{e.preventDefault();if(!name.trim()||Number(target)<=0)return;onSubmit({name:name.trim(),targetAmount:Number(target),targetDate:targetDate||null,color});}}><Field label="What are you saving for?"><Input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="A weekend away, a rainy day…"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Target amount"><Input required type="number" min="0.01" step="0.01" value={target} onChange={e=>setTarget(e.target.value)} placeholder="1200.00"/></Field><Field label="Target date"><Input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/></Field></div><Field label="A color for this goal"><div className="flex gap-2">{colors.map(c=><button type="button" key={c} onClick={()=>setColor(c)} aria-label={`Choose ${c} goal color`} className={`grid h-8 w-8 place-items-center rounded-full transition ${c===color?'ring-2 ring-[#315843] ring-offset-2':''}`} style={{backgroundColor:c}}>{c===color&&<Check size={14} className="text-white"/>}</button>)}</div></Field><div className="flex justify-end gap-2 pt-2"><ActionButton secondary onClick={onClose}>Cancel</ActionButton><ActionButton type="submit">{busy?'Saving…':mode==='create'?'Create goal':'Save changes'}</ActionButton></div></form></Modal>;
}
function ContributionForm({goal,busy,onClose,onSubmit}:{goal:any;busy:boolean;onClose:()=>void;onSubmit:(value:{amount:number;date:string;note:string|null})=>void}) {
  const [amount,setAmount]=useState(''); const [date,setDate]=useState(today()); const [note,setNote]=useState('');
  return <Modal title="Add to your goal" subtitle={`A little more toward ${goal.name}.`} onClose={onClose}><form className="space-y-4" onSubmit={e=>{e.preventDefault();if(Number(amount)<=0)return;onSubmit({amount:Number(amount),date,note:note.trim()||null});}}><Field label="Amount"><Input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="25.00"/></Field><Field label="When did you add it?"><Input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="A note (optional)"><Input maxLength={250} value={note} onChange={e=>setNote(e.target.value)} placeholder="A little from this week’s sales"/></Field><div className="flex justify-end gap-2 pt-2"><ActionButton secondary onClick={onClose}>Cancel</ActionButton><ActionButton type="submit">{busy?'Adding…':'Add contribution'}</ActionButton></div></form></Modal>;
}
function ContributionHistory({goalId,goal,onClose,onChanged}:{goalId:string;goal:any;onClose:()=>void;onChanged:()=>void}) {
  const client=useQueryClient(); const {data=[],isLoading,isError,refetch}=useGetGoalContributions(goalId,{query:{enabled:!!goalId,queryKey:getGetGoalContributionsQueryKey(goalId)}});
  const remove=useDeleteContribution();
  return <Modal title="Contribution history" subtitle={goal?.name??'Goal'} onClose={onClose}><div className="mb-4 flex items-center justify-between rounded-xl bg-[#eee9dc] p-3"><span className="text-[11px] text-[#728071]">Saved so far</span><b className="font-serif text-[19px]">{money(goal?.savedAmount)}</b></div>{isLoading?<div className="h-24 animate-pulse rounded-xl bg-[#ece7db]"/>:isError?<div className="py-5 text-center text-sm">Couldn’t load history. <button className="underline" onClick={()=>void refetch()}>Try again</button></div>:data.length?<div className="max-h-[360px] divide-y divide-[#ebe5d8] overflow-y-auto">{data.map(contribution=><div key={contribution.id} className="flex items-center gap-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e5eee1] text-[#4c7959]"><ArrowDownLeft size={15}/></span><div className="min-w-0 flex-1"><p className="mb-0 text-[12px] font-semibold">{money(contribution.amount)}</p><p className="mb-0 mt-0.5 truncate text-[10px] text-[#8a9589]">{dateLabel(contribution.date)}{contribution.note?` · ${contribution.note}`:''}</p></div><IconButton label="Remove contribution" onClick={()=>{if(window.confirm('Remove this contribution?'))remove.mutate({contributionId:contribution.id},{onSuccess:()=>{void client.invalidateQueries({queryKey:getGetGoalContributionsQueryKey(goalId)});onChanged();}});}}><Trash2 size={14}/></IconButton></div>)}</div>:<EmptyState title="No contributions yet" body="When you add money to this goal, the dates and notes will be kept here."/>}</Modal>;
}

function InventoryPage() {
  const client=useQueryClient(); const {data:items=[],isLoading,isError,refetch}=useGetItems();
  const create=useCreateItem(),update=useUpdateItem(),remove=useDeleteItem();
  const [status,setStatus]=useState('all'); const [platform,setPlatform]=useState('all'); const [search,setSearch]=useState('');
  const [form,setForm]=useState<{mode:'create'|'edit'|'sale';item?:any}|null>(null);
  const invalidate=()=>{void client.invalidateQueries({queryKey:getGetItemsQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});};
  const platforms=useMemo(()=>Array.from(new Set(items.map(i=>i.platform).filter(Boolean) as string[])).sort(),[items]);
  const filtered=items.filter(item=>(status==='all'||item.status===status)&&(platform==='all'||item.platform===platform)&&(!search||`${item.name} ${item.brand??''} ${item.category??''}`.toLowerCase().includes(search.toLowerCase())));
  const sold=items.filter(i=>i.status==='sold'); const profit=sold.reduce((a,i)=>a+(i.netProfit??0),0);
  return <div className="money-page">
    <PageHeading kicker="Found, loved, flipped" title="Resale notebook" text="Track what you paid, where it went, and what actually made it back to you." action={<ActionButton onClick={()=>setForm({mode:'create'})} testId="button-add-item"><Plus size={15}/> Add a find</ActionButton>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><SummaryCard label="Take-home profit" value={money(profit)} icon={<Banknote size={16}/>} detail="After fees, shipping and costs"/><SummaryCard label="Pieces in the notebook" value={`${items.length}`} icon={<Boxes size={16}/>} detail={`${items.filter(i=>i.status==='inventory'||i.status==='listed').length} still in the works`}/><SummaryCard label="Sold pieces" value={`${sold.length}`} icon={<BadgeCheck size={16}/>} detail={sold.length?'Every sold item has a profit story':'Your first sale is ahead'}/></div>
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e9e3d6] p-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div><h2 className="mb-1 font-serif text-[21px]">Every piece, accounted for</h2><p className="mb-0 text-[10px] text-[#879184]">{filtered.length} {filtered.length===1?'piece':'pieces'} shown · net profit reflects all costs</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[180px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91998d]"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a piece…" aria-label="Search inventory" className="pl-9"/></label>
          <Select aria-label="Filter by status" value={status} onChange={e=>setStatus(e.target.value)} className="w-auto min-w-[130px]"><option value="all">All statuses</option><option value="inventory">In inventory</option><option value="listed">Listed</option><option value="sold">Sold</option><option value="returned">Returned</option></Select>
          <Select aria-label="Filter by platform" value={platform} onChange={e=>setPlatform(e.target.value)} className="w-auto min-w-[130px]"><option value="all">All platforms</option>{platforms.map(p=><option value={p} key={p}>{p}</option>)}</Select>
        </div>
      </div>
      {isLoading?<div className="space-y-3 p-5">{[1,2,3].map(n=><div key={n} className="h-16 animate-pulse rounded-xl bg-[#eee9dc]"/> )}</div>:isError?<div className="p-5"><ErrorMessage retry={()=>{void refetch();}}/></div>:filtered.length?<div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="bg-[#f5f1e7] text-[9px] font-bold uppercase tracking-[.13em] text-[#818b7f]"><th className="px-5 py-3">Piece</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Listed / sold</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3 text-right">Take-home</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-[#eee8dc]">{filtered.map(item=><tr key={item.id} data-testid={`row-item-${item.id}`} className="group transition-colors hover:bg-[#f8f5ec]"><td className="px-5 py-3.5"><p className="mb-0 text-[12px] font-semibold">{item.name}</p><p className="mb-0 mt-0.5 text-[10px] text-[#899388]">{[item.brand,item.size,item.category].filter(Boolean).join(' · ')||'Uncategorized'} · picked up {dateLabel(item.purchaseDate)}</p></td><td className="px-4 py-3"><StatusBadge status={item.status}/></td><td className="px-4 py-3 font-mono text-[11px]">{money(item.purchasePrice)}</td><td className="px-4 py-3 font-mono text-[11px]">{money(item.status==='sold'?item.soldPrice:item.listingPrice)}</td><td className="px-4 py-3 text-[11px] text-[#768176]">{item.platform||'—'}</td><td className="px-4 py-3 text-right font-mono text-[11px] font-medium">{item.status==='sold'?<span className={(item.netProfit??0)>=0?'text-[#477555]':'text-[#a45f4d]'}>{money(item.netProfit)}<span className="ml-1 text-[9px] text-[#879184]">{item.profitMargin!=null?`${item.profitMargin.toFixed(0)}%`:''}</span></span>:<span className="text-[#afb4a8]">—</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">{item.status!=='sold'&&<IconButton label={`Record sale for ${item.name}`} onClick={()=>setForm({mode:'sale',item})}><Banknote size={14}/></IconButton>}<IconButton label={`Edit ${item.name}`} onClick={()=>setForm({mode:'edit',item})}><Pencil size={14}/></IconButton><IconButton label={`Delete ${item.name}`} onClick={()=>{if(window.confirm(`Delete “${item.name}” from your notebook?`))remove.mutate({itemId:item.id},{onSuccess:invalidate});}}><Trash2 size={14}/></IconButton></div></td></tr>)}</tbody></table></div>:<EmptyState title={items.length?'Nothing in this view':'Your next good find starts here'} body={items.length?'Try changing the filters or search for another piece.':'Add a thrifted piece to keep its costs, listing and take-home profit in one place.'} action={!items.length?<ActionButton onClick={()=>setForm({mode:'create'})}><Plus size={14}/> Add a find</ActionButton>:undefined}/>}
    </Panel>
    {form&&<ItemForm mode={form.mode} item={form.item} busy={create.isPending||update.isPending} onClose={()=>setForm(null)} onSubmit={value=>{if(form.mode==='create')create.mutate({data:value},{onSuccess:()=>{invalidate();setForm(null);}});else if(form.item)update.mutate({itemId:form.item.id,data:value},{onSuccess:()=>{invalidate();setForm(null);}});}}/>}
  </div>;
}
function StatusBadge({status}:{status:string}) {const styles:Record<string,string>={inventory:'bg-[#f0e8d5] text-[#876b3c]',listed:'bg-[#e5ebf4] text-[#536d91]',sold:'bg-[#e3ede1] text-[#4e7758]',returned:'bg-[#f2e5e1] text-[#956452]'};const label:Record<string,string>={inventory:'In inventory',listed:'Listed',sold:'Sold',returned:'Returned'};return <span data-testid={`status-${status}`} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold ${styles[status]||styles.inventory}`}>{label[status]||status}</span>;}
function ItemForm({mode,item,busy,onClose,onSubmit}:{mode:'create'|'edit'|'sale';item?:any;busy:boolean;onClose:()=>void;onSubmit:(value:any)=>void}) {
  const [values,setValues]=useState(()=>({name:item?.name??'',category:item?.category??'',brand:item?.brand??'',size:item?.size??'',status:mode==='sale'?'sold':(item?.status??'inventory'),purchasePrice:String(item?.purchasePrice??''),purchaseDate:item?.purchaseDate?.slice(0,10)??today(),listingPrice:item?.listingPrice==null?'':String(item.listingPrice),soldPrice:item?.soldPrice==null?'':String(item.soldPrice),platform:item?.platform??'',platformFee:item?.platformFee==null?'':String(item.platformFee),paymentFee:item?.paymentFee==null?'':String(item.paymentFee),shippingCost:item?.shippingCost==null?'':String(item.shippingCost),otherCosts:item?.otherCosts==null?'':String(item.otherCosts),soldDate:item?.soldDate?.slice(0,10)??today(),notes:item?.notes??''}));
  const set=(key:string,value:string)=>setValues(v=>({...v,[key]:value}));
  const field=(key:string,label:string,props:any={})=><Field key={key} label={label}><Input {...props} value={(values as any)[key]} onChange={e=>set(key,e.target.value)}/></Field>;
  const nullable=(s:string)=>s.trim()===''?null:Number(s);
  return <Modal wide title={mode==='sale'?'Record the sale':'Add the details'} subtitle={mode==='sale'?'See what this piece really earned after every cost.':'Keep the useful details together, from thrift find to take-home.'} onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault();if(!values.name.trim()||Number(values.purchasePrice)<0)return;const value={name:values.name.trim(),category:values.category||null,brand:values.brand||null,size:values.size||null,status:values.status,purchasePrice:Number(values.purchasePrice),purchaseDate:values.purchaseDate,listingPrice:nullable(values.listingPrice),soldPrice:nullable(values.soldPrice),platform:values.platform||null,platformFee:nullable(values.platformFee),paymentFee:nullable(values.paymentFee),shippingCost:nullable(values.shippingCost),otherCosts:nullable(values.otherCosts),soldDate:values.status==='sold'?(values.soldDate||today()):null,notes:values.notes||null};onSubmit(value);}} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">{field('name','Piece name',{required:true,maxLength:160,placeholder:'Vintage wool cardigan'})}{field('category','Category',{maxLength:80,placeholder:'Knitwear'})}{field('brand','Brand',{maxLength:100,placeholder:'Optional'})}{field('size','Size',{maxLength:40,placeholder:'Optional'})}</div>
      <div className="grid gap-3 sm:grid-cols-3">{field('purchasePrice','What you paid',{required:true,type:'number',min:'0',step:'0.01',placeholder:'12.00'})}{field('purchaseDate','Purchase date',{required:true,type:'date'})}<Field label="Piece status"><Select value={values.status} onChange={e=>set('status',e.target.value)}><option value="inventory">In inventory</option><option value="listed">Listed</option><option value="sold">Sold</option><option value="returned">Returned</option></Select></Field></div>
      <div className="rounded-2xl border border-[#e6dfd1] bg-[#f5f1e7] p-4"><p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#796b52]"><ReceiptText size={14}/> Listing &amp; take-home details</p><div className="grid gap-3 sm:grid-cols-3">{field('listingPrice','Listing price',{type:'number',min:'0',step:'0.01',placeholder:'Optional'})}{field('soldPrice','Sold for',{type:'number',min:'0',step:'0.01',placeholder:'If sold'})}{field('platform','Platform',{maxLength:80,placeholder:'Depop, eBay…'})}{field('platformFee','Platform fee',{type:'number',min:'0',step:'0.01',placeholder:'0.00'})}{field('paymentFee','Payment fee',{type:'number',min:'0',step:'0.01',placeholder:'0.00'})}{field('shippingCost','Shipping cost',{type:'number',min:'0',step:'0.01',placeholder:'0.00'})}{field('otherCosts','Other costs',{type:'number',min:'0',step:'0.01',placeholder:'0.00'})}{field('soldDate','Sale date',{type:'date'})}</div></div>
      <Field label="Notes"><Input maxLength={2000} value={values.notes} onChange={e=>set('notes',e.target.value)} placeholder="Condition, repair, listing details…"/></Field>
      {values.status==='sold'&&values.soldPrice!==''&&<div className="flex items-center justify-between rounded-xl bg-[#e5eee1] px-4 py-3"><span className="text-[11px] font-semibold text-[#476950]">Estimated take-home profit</span><span className="font-mono text-[13px] font-semibold text-[#315843]">{money(Number(values.soldPrice)-Number(values.purchasePrice||0)-Number(values.platformFee||0)-Number(values.paymentFee||0)-Number(values.shippingCost||0)-Number(values.otherCosts||0))}</span></div>}
      <div className="flex justify-end gap-2 pt-1"><ActionButton secondary onClick={onClose}>Cancel</ActionButton><ActionButton type="submit">{busy?'Saving…':mode==='sale'?'Save sale details':mode==='create'?'Add to notebook':'Save changes'}</ActionButton></div>
    </form>
  </Modal>;
}

function Landing() {
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f5f2e9] text-[#263c32]">
    <header className="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-5 py-5 md:px-10">
      <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-landing-brand"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#315843] text-[#e6c47d]"><Coins size={20}/></span><span className="font-serif text-[22px] text-[#263c32]">MoneyTrack</span></Link>
      <div className="flex items-center gap-2"><Link href="/sign-in" className="hidden rounded-xl px-3 py-2 text-[12px] font-semibold text-[#43584a] no-underline transition hover:bg-[#eae6da] sm:inline-flex" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="rounded-xl bg-[#315843] px-4 py-[11px] text-[12px] font-semibold text-[#f7f1e3] no-underline shadow-sm transition hover:bg-[#254b35]" data-testid="link-sign-up">Make your money book</Link></div>
    </header>
    <main className="mx-auto max-w-[1280px] px-5 pb-12 md:px-10">
      <section className="relative grid min-h-[580px] items-center gap-12 py-14 md:grid-cols-[1.08fr_.92fr] md:py-20">
        <div className="absolute -left-40 top-10 h-[440px] w-[440px] rounded-full bg-[#e9e4d4] opacity-50 blur-3xl"/>
        <div className="relative z-10"><p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#967552]"><span className="h-px w-7 bg-[#b98a61]"/>For the good finds and the bigger plans</p><h1 className="mb-6 max-w-[620px] font-serif text-[48px] leading-[1.02] tracking-[-.045em] md:text-[70px]">Keep the money story <span className="italic text-[#a7775b]">clear.</span></h1><p className="mb-8 max-w-[485px] text-[15px] leading-[1.8] text-[#6f7c70]">A personal money notebook for saving toward what matters and seeing what every thrifted piece really earns you.</p><div className="flex flex-wrap gap-3"><Link href="/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-[#315843] px-5 py-3.5 text-[12px] font-semibold text-[#f7f1e3] no-underline shadow-[0_8px_20px_rgba(43,75,55,.14)] transition hover:-translate-y-0.5 hover:bg-[#254b35]" data-testid="link-start"><Sparkles size={15}/> Start your money book <ArrowRight size={15}/></Link><Link href="/sign-in" className="inline-flex items-center gap-2 rounded-xl border border-[#dcd6c7] bg-[#fbf9f2] px-5 py-3.5 text-[12px] font-semibold text-[#43584a] no-underline transition hover:bg-[#f0eee3]" data-testid="link-returning">I already have an account</Link></div><div className="mt-9 flex items-center gap-3 text-[10px] text-[#879184]"><span className="flex -space-x-2"><i className="h-7 w-7 rounded-full border-2 border-[#f5f2e9] bg-[#d2b38a]"/><i className="h-7 w-7 rounded-full border-2 border-[#f5f2e9] bg-[#80977e]"/><i className="h-7 w-7 rounded-full border-2 border-[#f5f2e9] bg-[#c89172]"/></span><span>Made for real-life money, not spreadsheets</span></div></div>
        <div className="relative mx-auto w-full max-w-[500px]">
          <div className="absolute -right-6 top-4 h-[340px] w-[340px] rounded-full bg-[#e6d8b5]/70 blur-2xl"/>
          <div className="relative rotate-[1.5deg] rounded-[26px] border border-[#ded6c4] bg-[#fbf9f2] p-5 shadow-[0_24px_70px_rgba(56,67,49,.13)] md:p-7">
            <div className="mb-6 flex items-start justify-between border-b border-[#ece5d8] pb-4"><div><p className="mb-1 text-[9px] font-bold uppercase tracking-[.19em] text-[#967552]">Your money notebook</p><h2 className="mb-0 font-serif text-[24px]">A little progress</h2></div><span className="rounded-full bg-[#e6ede2] px-3 py-1.5 text-[9px] font-semibold text-[#52745b]">Looking good</span></div>
            <div className="mb-4 rounded-2xl bg-[#315843] p-5 text-[#f7f1e3]"><div className="mb-3 flex justify-between text-[9px] uppercase tracking-[.14em] text-[#c7d2bf]"><span>Cabin weekend</span><span>Goal 01</span></div><div className="mb-1 font-serif text-[31px]">$680 <span className="text-[14px] text-[#c7d2bf]">of $1,200</span></div><div className="mt-4 h-1.5 rounded-full bg-[#617b66]"><div className="h-full w-[57%] rounded-full bg-[#e5c37e]"/></div><div className="mt-2 flex justify-between text-[9px] text-[#c7d2bf]"><span>57% of the way there</span><span>Keep going</span></div></div>
            <div className="rounded-2xl border border-[#ebe4d7] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-[#98795a]">Latest thrift flip</p><p className="mb-0 font-serif text-[18px]">Linen chore jacket</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0eadc] text-[#8b7854]"><ShoppingBag size={17}/></span></div><div className="flex items-end justify-between"><div><span className="block text-[9px] text-[#8c9588]">Sold for $74 · all costs $19.40</span><span className="mt-1 block text-[9px] text-[#8c9588]">After fees, postage and what you paid</span></div><span className="font-mono text-[21px] font-medium text-[#477555]">+$54.60</span></div></div>
            <div className="absolute -bottom-7 -left-7 rounded-2xl border border-[#e5dfd1] bg-[#fffaf0] px-4 py-3 shadow-lg"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#475f4b]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e8eee3]"><TrendingUp size={14}/></span>Every cost, counted.</div></div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 border-t border-[#e3ddcf] py-12 md:grid-cols-3 md:py-16">
        <div className="pb-2 md:pr-8"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#9b7758]">Two sides of your money</p><h2 className="mb-0 font-serif text-[31px] leading-tight">Keep the why and the how close.</h2></div>
        <div className="rounded-2xl border border-[#e4ddcf] bg-[#fbf9f2] p-5"><span className="mb-5 grid h-9 w-9 place-items-center rounded-xl bg-[#e8eee3] text-[#51775c]"><Wallet size={17}/></span><h3 className="mb-2 font-serif text-[21px]">Save toward something</h3><p className="mb-0 text-[12px] leading-[1.7] text-[#798579]">Name the goal, set a target, and log each contribution with its date and a note. Progress stays easy to see.</p></div>
        <div className="rounded-2xl border border-[#e4ddcf] bg-[#fbf9f2] p-5"><span className="mb-5 grid h-9 w-9 place-items-center rounded-xl bg-[#f1e6d8] text-[#9a6e4d]"><ReceiptText size={17}/></span><h3 className="mb-2 font-serif text-[21px]">Know what a flip earned</h3><p className="mb-0 text-[12px] leading-[1.7] text-[#798579]">Purchase price, fees, shipping and extra costs all count. See take-home profit—not just the sale price.</p></div>
      </section>
      <section className="mb-7 flex flex-col justify-between gap-5 rounded-[24px] bg-[#e7dfc9] p-6 md:flex-row md:items-center md:p-9"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#967552]">A calmer money check-in</p><h2 className="mb-2 font-serif text-[29px] md:text-[34px]">Your progress deserves a home.</h2><p className="mb-0 text-[12px] text-[#737d70]">One personal notebook for savings goals and the pieces you pass along.</p></div><Link href="/sign-up" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#315843] px-5 py-3 text-[12px] font-semibold text-[#f7f1e3] no-underline transition hover:bg-[#254b35] md:self-auto">Start writing it down <ArrowRight size={14}/></Link></section>
    </main>
    <footer className="mx-auto flex max-w-[1280px] justify-between px-5 pb-6 text-[10px] text-[#8b9386] md:px-10"><span>MoneyTrack · your money, in motion</span><span>Personal by design.</span></footer>
  </div>;
}
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/dashboard"/></Show><Show when="signed-out"><Landing/></Show></>; }
function ProtectedPage({children}:{children:ReactNode}) { return <><Show when="signed-in"><ErrorBoundary><Shell>{children}</Shell></ErrorBoundary></Show><Show when="signed-out"><Redirect to="/"/></Show></>; }
function SignInPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f2e9] px-4 py-8"><div className="mb-4 w-full"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>; }
function SignUpPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f2e9] px-4 py-8"><div className="mb-4 w-full"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>; }
function ClerkCacheInvalidator() {
  const { addListener } = useClerk(); const client = useQueryClient(); const previousUserId = useRef<string|null|undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({user})=>{ const next=user?.id??null; if(previousUserId.current!==undefined&&previousUserId.current!==next)client.clear(); previousUserId.current=next; });
    return unsubscribe;
  }, [addListener,client]);
  return null;
}
function AppRoutes() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{signIn:{start:{title:'Welcome back',subtitle:'Your money notebook is waiting.'}},signUp:{start:{title:'Start your money notebook',subtitle:'A clear little place for your savings and sales.'}}}} routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><ClerkCacheInvalidator/><Switch>
      <Route path="/" component={HomeRedirect}/>
      <Route path="/sign-in/*?" component={SignInPage}/>
      <Route path="/sign-up/*?" component={SignUpPage}/>
      <Route path="/dashboard">{()=><ProtectedPage><Overview/></ProtectedPage>}</Route>
      <Route path="/goals">{()=><ProtectedPage><GoalsPage/></ProtectedPage>}</Route>
      <Route path="/inventory">{()=><ProtectedPage><InventoryPage/></ProtectedPage>}</Route>
      <Route component={NotFound}/>
    </Switch><Toaster/></QueryClientProvider>
  </ClerkProvider>;
}
function App() { return <TooltipProvider><WouterRouter base={basePath}><AppRoutes/></WouterRouter></TooltipProvider>; }
export default App;