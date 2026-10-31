import React, { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowRight,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Clock,
  MapPin,
  LogOut,
  Utensils,
  ChefHat,
  ClipboardList,
  CircleUserRound,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Smartphone,
  Monitor,
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Users,
  Award,
  Star,
  Check,
  Shield,
  ArrowUpRight,
  RefreshCw,
  FileText,
  UploadCloud,
  CheckCircle,
} from 'lucide-react';
import {
  api,
  safeArray,
  safeString,
  safeNumber,
  type User,
  type Outlet,
  type Food,
  type Order,
  type Table,
  type NotificationItem,
  type HardwareStatus,
  type CanteenStatus,
} from './services/api';
import { useCart } from './store/cart';

// Authentic Fisheye Food Photography Assets
const MASALA_DOSA_IMG = "/src/assets/images/masala_dosa_fisheye_1793394719149.jpg";
const PAV_BHAJI_IMG = "/src/assets/images/pav_bhaji_fisheye_1793394718269.jpg";
const VADA_PAV_IMG = "/src/assets/images/vada_pav_fisheye_1793394718933.jpg";
const PANEER_BUTTER_IMG = "/src/assets/images/paneer_butter_masala_fisheye_1793394718861.jpg";

// ==========================================
// DECORATIVE SCRAPBOOK ASSETS (SVG & BADGES)
// ==========================================
function YellowCrownDoodle() {
  return (
    <svg width="42" height="26" viewBox="0 0 42 26" fill="none" className="inline-block">
      <path d="M3 21L7 6L16 16L21 3L26 16L35 6L39 21H3Z" fill="#F9E900" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="7" cy="5" r="2" fill="#000000"/>
      <circle cx="21" cy="3" r="2" fill="#000000"/>
      <circle cx="35" cy="5" r="2" fill="#000000"/>
    </svg>
  );
}

function MumbaiStamp() {
  return (
    <div className="stamp-mumbai">
      <MapPin size={12} className="text-[#2A00FF]" />
      <span>MUMBAI / DJSCE · POSTMARK 001</span>
    </div>
  );
}

function BlueCheckeredPatch() {
  return <div className="checkered-badge" title="BYTE Pattern" />;
}

// Application Level Safe Error Boundary (Part N4)
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[BYTE Frontend ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
          <div className="clean-card max-w-md p-8 border-2 border-black bg-white space-y-4">
            <div className="w-12 h-12 bg-[#F9E900] border-2 border-black mx-auto grid place-items-center font-black">!</div>
            <h2 className="text-2xl font-black">Platform View Recovered</h2>
            <p className="text-xs text-zinc-600">BYTE encountered an unexpected component issue and prevented a crash.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="btn btn-yellow w-full text-xs"
            >
              Return to Campus Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// SHELL / LAYOUT COMPONENT
// ==========================================
function Shell({
  user,
  onLogout,
  isMobileFrame,
  toggleMobileFrame,
  children,
}: {
  user: User | null;
  onLogout: () => void;
  isMobileFrame: boolean;
  toggleMobileFrame: () => void;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const cart = useCart();
  const [showNotifications, setShowNotifications] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<NotificationItem[]>('/notifications')).data,
    enabled: !!user,
  });

  const unreadCount = safeArray<NotificationItem>(notificationsQuery.data).filter(n => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Top Bar Header with Official BYTE Brand Logo */}
      <header className="byte-header">
        {/* Left: Official BYTE Logo & Tagline */}
        <div className="brand-wrap">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/byte-logo.png"
              alt="BYTE"
              className="brand-logo-img"
            />
          </Link>
          <span className="brand-platform-tag hidden md:inline-block">
            THE SMART UNIFYING CANTEEN PLATFORM · DJSCE
          </span>
        </div>

        {/* Center: Clean Editorial Navigation */}
        <nav className="nav-group">
          <Link
            to="/"
            className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/menu"
            className={`nav-item ${location.pathname.startsWith('/menu') ? 'active' : ''}`}
          >
            Menu
          </Link>
          <Link
            to="/tables"
            className={`nav-item ${location.pathname === '/tables' ? 'active' : ''}`}
          >
            Tables
          </Link>
          <Link
            to="/status"
            className={`nav-item ${location.pathname === '/status' ? 'active' : ''}`}
          >
            Canteens
          </Link>
          <Link
            to="/orders"
            className={`nav-item ${location.pathname === '/orders' ? 'active' : ''}`}
          >
            Orders
          </Link>
          <Link
            to="/rewards"
            className={`nav-item ${location.pathname === '/rewards' ? 'active' : ''}`}
          >
            Rewards
          </Link>
          {(user?.role === 'vendor' || user?.role === 'admin') && (
            <Link
              to="/vendor"
              className={`nav-item ${location.pathname === '/vendor' ? 'active' : ''}`}
            >
              Kitchen
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right: Controls & Profile */}
        <div className="flex items-center gap-3">
          {/* Viewport Frame Switcher */}
          <button
            onClick={toggleMobileFrame}
            className="icon-button-clean"
            title={isMobileFrame ? "Switch to 1440px Desktop View" : "Simulate 390px Mobile View"}
          >
            {isMobileFrame ? <Monitor size={16} /> : <Smartphone size={16} />}
          </button>

          {/* Notifications */}
          {user && (
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="icon-button-clean relative"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DD1C1A] text-white font-mono text-[9px] font-bold rounded-full grid place-items-center">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile / Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold bg-white text-black hover:bg-[#F9E900]"
              >
                <CircleUserRound size={15} />
                <span>KEERTHI</span>
              </Link>
              <button
                onClick={onLogout}
                className="icon-button-clean"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-yellow btn-sm">
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}>
          <div className="w-full max-w-md bg-white border-l-2 border-black h-full flex flex-col p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
              <div>
                <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider">CAMPUS DISPATCH</span>
                <h3 className="text-xl font-bold font-mono">NOTIFICATIONS</h3>
              </div>
              <button onClick={() => setShowNotifications(false)} className="icon-button-clean">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {safeArray<NotificationItem>(notificationsQuery.data).map(note => (
                <div
                  key={note.id}
                  className="p-4 border-2 border-black bg-white"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider">
                      {note.title}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {note.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content Body / Optional Mobile Frame Wrapper */}
      <div className={`flex-1 bg-white ${isMobileFrame ? 'max-w-[400px] mx-auto my-6 border-4 border-black shadow-[8px_8px_0_#F9E900]' : ''}`}>
        {children}
      </div>

      {/* Floating Tray Button */}
      {cart.lines.length > 0 && location.pathname !== '/cart' && (
        <Link
          to="/cart"
          className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 bg-[#F9E900] text-black border-2 border-black px-6 py-3 flex items-center gap-4 font-mono text-xs font-bold shadow-[4px_4px_0_#000000] z-30 whitespace-nowrap"
        >
          <ShoppingBag size={16} />
          <span>{cart.lines.reduce((a, b) => a + b.quantity, 0)} ITEMS IN TRAY</span>
          <span className="border-l border-black pl-3 font-extrabold">₹{cart.total().toFixed(0)}</span>
          <ArrowRight size={14} />
        </Link>
      )}

      {/* Mobile 5-Tab Navigation Bar */}
      <nav className="mobile-nav-bar bg-white border-t-2 border-black">
        <Link to="/" className={`mobile-nav-btn ${location.pathname === '/' ? 'active' : ''}`}>
          <Utensils size={18} />
          <span>Home</span>
        </Link>
        <Link to="/menu" className={`mobile-nav-btn ${location.pathname.startsWith('/menu') ? 'active' : ''}`}>
          <Search size={18} />
          <span>Menu</span>
        </Link>
        <Link to="/tables" className={`mobile-nav-btn ${location.pathname === '/tables' ? 'active' : ''}`}>
          <Users size={18} />
          <span>Tables</span>
        </Link>
        <Link to="/orders" className={`mobile-nav-btn ${location.pathname === '/orders' ? 'active' : ''}`}>
          <ClipboardList size={18} />
          <span>Orders</span>
        </Link>
        <Link to="/profile" className={`mobile-nav-btn ${location.pathname === '/profile' ? 'active' : ''}`}>
          <CircleUserRound size={18} />
          <span>Profile</span>
        </Link>
      </nav>

      {/* Campus Footer */}
      <footer className="border-t-2 border-black py-6 px-6 bg-white font-mono text-xs flex flex-col sm:flex-row justify-between items-center gap-4 text-zinc-600 mb-16 sm:mb-0">
        <div>BYTE / DJSCE CAMPUS FOOD OS · MUMBAI</div>
        <div className="flex gap-4">
          <span>AAJ KYA KHAAYE?</span>
          <span>·</span>
          <span>THE UNIFYING CANTEEN PLATFORM</span>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// SCREEN 01: CLEAN WHITE AUTHENTICATION & DEMO ACCOUNTS
// ==========================================
function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('student@example.com');
  const [password, setPassword] = useState('ByteStudent123!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      onLogin(res.data);
    } catch {
      setError('Could not sign in. Please verify your credentials.');
    } finally {
      setBusy(false);
    }
  }

  function setPreset(e: string, p: string) {
    setEmail(e);
    setPassword(p);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="border-2 border-black bg-white p-6 sm:p-10 shadow-[6px_6px_0_#F9E900]">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="mb-4">
              <img src="/byte-logo.png" alt="BYTE" className="h-9 w-auto" />
            </div>
            <div className="stamp-mumbai mb-3">
              <span>DJSCE MUMBAI · CAMPUS ID PORTAL</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-none mb-3">
              Good food, better days.
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6">
              Skip queues, reserve dining tables, order ahead, and pick up using express QR verification.
            </p>

            <div className="p-4 border-2 border-dashed border-zinc-300 space-y-2 font-mono text-xs bg-white">
              <div className="font-bold text-[10px] text-zinc-500 uppercase">QUICK DEMO ACCESS:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreset('student@example.com', 'ByteStudent123!')}
                  className="p-2 border border-black text-left bg-white hover:bg-[#F9E900] hover:text-black font-bold"
                >
                  Student (KEERTHI)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('vendor@example.com', 'ByteVendor123!')}
                  className="p-2 border border-black text-left bg-white hover:bg-[#F9E900] hover:text-black font-bold"
                >
                  Central Canteen
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('vendor.chai@example.com', 'ByteVendor123!')}
                  className="p-2 border border-black text-left bg-white hover:bg-[#F9E900] hover:text-black font-bold"
                >
                  Chai Counter
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('admin@example.com', 'ByteAdmin123!')}
                  className="p-2 border border-black text-left bg-white hover:bg-[#F9E900] hover:text-black font-bold"
                >
                  Administrator
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 border-t-2 md:border-t-0 md:border-l-2 border-black pt-6 md:pt-0 md:pl-8 bg-white">
            <h2 className="text-2xl font-bold font-mono">CAMPUS SIGN IN</h2>

            <div>
              <label className="block font-mono text-xs font-bold mb-1">EMAIL ADDRESS</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-3 border-2 border-black bg-white font-mono text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold mb-1">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full p-3 border-2 border-black bg-white font-mono text-sm focus:outline-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border-2 border-[#DD1C1A] text-[#DD1C1A] font-mono text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-yellow w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
            >
              {busy ? 'SIGNING IN...' : 'ENTER BYTE PLATFORM'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// SCREEN 02: HOME DASHBOARD (CLEAN WHITE BG, DJSCE & KEERTHI)
// ==========================================
function Home({
  onSelectFood,
}: {
  onSelectFood: (f: Food) => void;
}) {
  const navigate = useNavigate();
  const cart = useCart();
  const [searchTerm, setSearchTerm] = useState('');

  const canteenStatus = useQuery({
    queryKey: ['canteen-status'],
    queryFn: async () => (await api.get<CanteenStatus>('/canteen-status')).data,
  });

  const foodsQuery = useQuery({
    queryKey: ['all-foods'],
    queryFn: async () => (await api.get<Food[]>('/foods')).data,
  });

  const allFoods = safeArray<Food>(foodsQuery.data);
  const popularFoods = allFoods.filter(f => f.is_popular);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeDish = popularFoods[activeIdx] || allFoods[0] || null;

  function nextDish() {
    if (!popularFoods.length) return;
    setActiveIdx((prev) => (prev + 1) % popularFoods.length);
  }

  function prevDish() {
    if (!popularFoods.length) return;
    setActiveIdx((prev) => (prev - 1 + popularFoods.length) % popularFoods.length);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/menu?search=${encodeURIComponent(searchTerm)}`);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-12 bg-white">
      {/* 1. MOCKUP HERO SECTION: GOOD FOOD ALL DAY */}
      <section className="clean-card relative overflow-hidden bg-white">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="sticker-yellow-tag">EAT GOOD STAY BOLD</span>
              <MumbaiStamp />
            </div>

            <div className="font-mono text-xs font-bold text-[#2A00FF] mb-2 tracking-wider">
              WELCOME BACK, KEERTHI
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[0.95] mb-4">
              GOOD FOOD<br />
              ALL DAY
            </h1>

            <p className="text-base text-zinc-600 font-sans max-w-md mb-6">
              Your campus. Your canteens. One BYTE.
            </p>

            {/* Search Input matching Styleboard mockup */}
            <form onSubmit={handleSearch} className="flex border-2 border-black max-w-md bg-white shadow-[3px_3px_0_#F9E900]">
              <div className="p-3 text-zinc-500">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search for food, canteens, or dishes..."
                className="w-full bg-transparent font-mono text-xs focus:outline-none"
              />
              <button type="submit" className="bg-[#F9E900] text-black px-4 font-mono font-bold text-xs flex items-center justify-center border-l-2 border-black">
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Hero Circular Fisheye Food Pan with Crown Annotation */}
          <div className="relative flex justify-center items-center">
            <div className="relative">
              {/* Crown doodle at top */}
              <div className="absolute -top-7 left-12 z-10">
                <YellowCrownDoodle />
              </div>

              {/* Checkered pattern sticker on corner */}
              <div className="absolute -bottom-3 -right-3 z-10">
                <BlueCheckeredPatch />
              </div>

              {/* Blue Community Sticker */}
              <div className="absolute -top-3 -right-4 z-10 hidden sm:block">
                <span className="sticker-blue-community">CANTEEN + COMMUNITY</span>
              </div>

              {/* Fisheye Food Circular Pan on Clean White Frame */}
              <div className="carousel-round-photo bg-white border-4 border-black">
                <img
                  src={activeDish?.image_url || PANEER_BUTTER_IMG}
                  alt="Campus Dish"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FOUR VALUE PILLARS (Clean White Cards, No Black BGs) */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clean-card p-5 bg-white">
          <div className="w-8 h-8 bg-[#2A00FF] text-white flex items-center justify-center mb-3 font-mono font-bold text-xs border-2 border-black">
            01
          </div>
          <h3 className="font-bold text-sm tracking-tight">SMART ORDERING</h3>
          <p className="text-xs text-zinc-600 mt-1">Skip the queues, order in advance.</p>
        </div>

        <div className="clean-card p-5 bg-white">
          <div className="w-8 h-8 bg-[#F9E900] text-black flex items-center justify-center mb-3 font-mono font-bold text-xs border-2 border-black">
            02
          </div>
          <h3 className="font-bold text-sm tracking-tight">MULTIPLE CANTEENS</h3>
          <p className="text-xs text-zinc-600 mt-1">One place, all your campus spots.</p>
        </div>

        <div className="clean-card p-5 bg-white">
          <div className="w-8 h-8 bg-[#DD1C1A] text-white flex items-center justify-center mb-3 font-mono font-bold text-xs border-2 border-black">
            03
          </div>
          <h3 className="font-bold text-sm tracking-tight">REAL-TIME UPDATES</h3>
          <p className="text-xs text-zinc-600 mt-1">Track your order, get notified.</p>
        </div>

        <div className="clean-card p-5 bg-white">
          <div className="w-8 h-8 bg-[#F9E900] text-black flex items-center justify-center mb-3 font-mono font-bold text-xs border-2 border-black">
            04
          </div>
          <h3 className="font-bold text-sm tracking-tight">REWARDS &amp; PERKS</h3>
          <p className="text-xs text-zinc-600 mt-1">Eat more, earn free drinks.</p>
        </div>
      </section>

      {/* 3. SIGNATURE TOP ORDERS CAROUSEL */}
      <section className="top-orders-carousel-box bg-white">
        <div className="flex justify-between items-center mb-8 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight">TOP ORDERS</h2>
            <YellowCrownDoodle />
          </div>

          <Link to="/menu" className="font-mono text-xs font-bold text-zinc-500 hover:text-black flex items-center gap-1">
            VIEW ALL <ArrowUpRight size={14} />
          </Link>
        </div>

        {activeDish && (
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Round Plate with Arrow Buttons */}
            <div className="relative flex items-center justify-center">
              <button
                onClick={prevDish}
                className="carousel-arrow-btn absolute left-2 sm:left-6 z-10"
                title="Previous"
              >
                <ChevronLeft size={22} />
              </button>

              <div className="carousel-round-photo bg-white border-4 border-black">
                <img
                  src={activeDish.image_url}
                  alt={activeDish.name}
                />
              </div>

              <button
                onClick={nextDish}
                className="carousel-arrow-btn absolute right-2 sm:right-6 z-10"
                title="Next"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {/* Dish Info & Action */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="starburst-hot">
                  MOST LOVED
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {activeDish.dietary_type === 'veg' ? 'PURE VEG' : 'NON-VEG'}
                </span>
              </div>

              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {activeIdx + 1}. {activeDish.name}
              </h3>

              <p className="text-sm text-zinc-600 leading-relaxed">
                {activeDish.description}
              </p>

              <div className="flex items-baseline gap-4 py-2 border-y-2 border-dashed border-zinc-200">
                <span className="font-mono text-3xl font-black">₹{activeDish.price}</span>
                <span className="font-mono text-xs text-zinc-500">READY IN ~{activeDish.prep_minutes} MINS</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => cart.add(activeDish.outlet_id, activeDish)}
                  className="btn btn-yellow flex-1 py-3 text-xs"
                >
                  <Plus size={15} /> ADD TO CART
                </button>
                <button
                  onClick={() => onSelectFood(activeDish)}
                  className="btn btn-white py-3 text-xs"
                >
                  DETAILS
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. REWARDS & BYTE POINTS HIGHLIGHT */}
      <section className="clean-card bg-white p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-2 border-black">
        <div>
          <span className="font-mono text-xs font-bold text-zinc-500 uppercase">LOYALTY NETWORK</span>
          <h3 className="text-2xl font-black mt-1">KEERTHI HAS 120 BYTE POINTS</h3>
          <p className="text-xs text-zinc-600 mt-1">
            Redeem ₹30 off or earn a free beverage after 5 orders.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono text-xs p-3 border-2 border-black bg-white text-center">
            <span className="text-zinc-500 block text-[10px]">PROGRESS</span>
            <b>3 / 5 ORDERS FOR FREE MEAL</b>
          </div>
          <Link to="/rewards" className="btn btn-yellow text-xs">
            REDEEM NOW
          </Link>
        </div>
      </section>
    </main>
  );
}

// ==========================================
// SCREEN 03: FOOD DISCOVERY & MENU CATALOGUE
// ==========================================
function MenuCatalogue({
  onSelectFood,
}: {
  onSelectFood: (f: Food) => void;
}) {
  const [search, setSearch] = useState('');
  const [activeOutlet, setActiveOutlet] = useState<number | 'ALL'>('ALL');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'JAIN'>('ALL');
  const cart = useCart();

  const outletsQuery = useQuery({
    queryKey: ['outlets'],
    queryFn: async () => (await api.get<Outlet[]>('/outlets')).data,
  });

  const foodsQuery = useQuery({
    queryKey: ['all-foods'],
    queryFn: async () => (await api.get<Food[]>('/foods')).data,
  });

  const foods = safeArray<Food>(foodsQuery.data);
  const outlets = safeArray<Outlet>(outletsQuery.data);

  function handleAddToCart(food: Food) {
    const success = cart.add(food.outlet_id, food);
    if (!success) {
      if (
        window.confirm(
          `Your tray currently contains items from ${cart.outletName || 'another canteen'}.\nWould you like to clear your tray and start a new order from ${food.outlet_name || 'this canteen'}?`
        )
      ) {
        cart.switchOutletAndAdd(food.outlet_id, food);
      }
    }
  }

  const filtered = foods.filter(item => {
    if (activeOutlet !== 'ALL' && item.outlet_id !== activeOutlet) return false;
    if (dietFilter === 'VEG' && item.dietary_type !== 'veg') return false;
    if (dietFilter === 'NON_VEG' && item.dietary_type !== 'non_veg') return false;
    if (dietFilter === 'JAIN' && !item.is_jain) return false;
    if (search) {
      const q = search.toLowerCase();
      const nameStr = (item.name || '').toLowerCase();
      const descStr = (item.description || '').toLowerCase();
      if (!nameStr.includes(q) && !descStr.includes(q)) return false;
    }
    return true;
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b-2 border-black pb-6">
        <div>
          <div className="stamp-mumbai mb-2">
            <span>FOOD DIRECTORY · DJSCE CANTEENS</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Menu Catalogue.</h1>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72 flex border-2 border-black bg-white">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search dish name..."
            className="w-full p-2.5 font-mono text-xs bg-white focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="p-2 text-zinc-500">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Outlet & Category Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveOutlet('ALL')}
            className={`px-3 py-1.5 border-2 border-black font-bold ${
              activeOutlet === 'ALL' ? 'bg-[#2A00FF] text-white' : 'bg-white text-black'
            }`}
          >
            ALL CANTEENS
          </button>
          {outlets.map(o => (
            <button
              key={o.id}
              onClick={() => setActiveOutlet(o.id)}
              className={`px-3 py-1.5 border-2 border-black font-bold whitespace-nowrap ${
                activeOutlet === o.id ? 'bg-[#2A00FF] text-white' : 'bg-white text-black'
              }`}
            >
              {o.name.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[10px]">DIET:</span>
          {(['ALL', 'VEG', 'NON_VEG', 'JAIN'] as const).map(dt => (
            <button
              key={dt}
              onClick={() => setDietFilter(dt)}
              className={`px-2.5 py-1 border border-black text-[11px] font-bold ${
                dietFilter === dt ? 'bg-[#F9E900] text-black' : 'bg-white text-black'
              }`}
            >
              {dt === 'NON_VEG' ? 'NON-VEG' : dt}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Dishes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {filtered.map(food => (
          <div key={food.id} className="clean-card p-0 flex flex-col overflow-hidden bg-white border-2 border-black">
            <div
              className="relative aspect-video bg-zinc-100 cursor-pointer border-b-2 border-black"
              onClick={() => onSelectFood(food)}
            >
              <img
                src={food.image_url}
                alt={food.name}
                onError={e => { (e.target as HTMLImageElement).src = '/images/food/placeholder.svg'; }}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 left-2 bg-white text-black border border-black font-mono text-[10px] font-bold px-2 py-0.5">
                {food.prep_minutes} MIN PREP
              </span>
              <div className="absolute top-2 right-2 flex gap-1">
                {food.is_jain && (
                  <span className="bg-[#F9E900] text-black border border-black font-mono text-[10px] font-bold px-1.5 py-0.5">
                    JAIN
                  </span>
                )}
                <span className="bg-white text-black border border-black font-mono text-[10px] font-bold px-2 py-0.5">
                  {food.dietary_type === 'veg' ? 'VEG' : 'NON-VEG'}
                </span>
              </div>
            </div>

            <div className="p-5 flex flex-col flex-1 bg-white">
              <div className="font-mono text-[10px] text-zinc-500 uppercase mb-1">
                {food.outlet_name || 'DJSCE CANTEEN'}
              </div>
              <h3
                onClick={() => onSelectFood(food)}
                className="font-bold text-lg cursor-pointer hover:underline"
              >
                {food.name}
              </h3>
              <p className="text-xs text-zinc-600 mt-1 line-clamp-2 flex-1">
                {food.description}
              </p>

              <div className="flex justify-between items-center pt-4 border-t border-dashed border-zinc-200 mt-4">
                <span className="font-mono text-xl font-bold">₹{food.price}</span>
                <button
                  onClick={() => handleAddToCart(food)}
                  className="btn btn-yellow btn-sm"
                >
                  <Plus size={14} /> ADD
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ==========================================
// SCREEN 04: MENU DETAIL MODAL
// ==========================================
function FoodDetailModal({
  food,
  onClose,
}: {
  food: Food | null;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();

  if (!food) return null;

  function handleAdd() {
    if (!food) return;
    for (let i = 0; i < quantity; i++) {
      cart.add(food.outlet_id, food);
    }
    onClose();
  }

  return (
    <div className="byte-modal-backdrop" onClick={onClose}>
      <div className="byte-modal-card p-6 bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
          <span className="font-mono text-xs font-bold text-zinc-500">
            ITEM ID: BYT-0{food.id}
          </span>
          <button onClick={onClose} className="icon-button-clean">
            <X size={16} />
          </button>
        </div>

        <div className="relative aspect-video w-full border-2 border-black mb-4 bg-zinc-100 overflow-hidden">
          <img src={food.image_url} alt={food.name} className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 sticker-yellow-tag">0.5× FISHEYE DIGICAM</span>
        </div>

        <h2 className="text-2xl font-black">{food.name}</h2>
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          {food.description}
        </p>

        <div className="grid grid-cols-3 gap-2 my-4 font-mono text-[11px] border-y border-dashed py-3 border-zinc-300">
          <div>
            <span className="text-zinc-500 block text-[9px]">DIET</span>
            <b>{food.dietary_type === 'veg' ? 'PURE VEG' : 'NON-VEG'}</b>
          </div>
          <div>
            <span className="text-zinc-500 block text-[9px]">PREP TIME</span>
            <b>{food.prep_minutes} MINS</b>
          </div>
          <div>
            <span className="text-zinc-500 block text-[9px]">PRICE</span>
            <b>₹{food.price}</b>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center border-2 border-black bg-white">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2.5">
              <Minus size={14} />
            </button>
            <span className="font-mono font-bold px-3 text-sm">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="p-2.5">
              <Plus size={14} />
            </button>
          </div>

          <button onClick={handleAdd} className="btn btn-yellow flex-1 py-3 text-xs font-bold">
            ADD TO CART · ₹{food.price * quantity}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SCREEN 05 & 06: FRUITFUL TRANSACTIONS — CART & THERMAL BILL
// ==========================================
function CartAndCheckout() {
  const cart = useCart();
  const navigate = useNavigate();
  const [pickupSlot, setPickupSlot] = useState('Immediate (~10 mins)');
  const [paymentChoice, setPaymentChoice] = useState<'upi' | 'counter'>('upi');
  const [busy, setBusy] = useState(false);
  const [confirmedBill, setConfirmedBill] = useState<any>(null);

  async function placeFruitfulOrder() {
    if (!cart.outletId || !cart.lines.length) return;
    setBusy(true);
    try {
      const res = await api.post('/checkout', {
        outlet_id: cart.outletId,
        items: cart.lines.map(l => ({ food_item_id: l.food.id, quantity: l.quantity })),
        idempotency_key: `order-${Date.now()}`,
        pickup_type: pickupSlot.includes('Immediate') ? 'immediate' : 'scheduled',
        scheduled_time: pickupSlot,
        payment_method: paymentChoice === 'upi' ? 'upi' : 'cash',
      });
      setConfirmedBill(res.data);
      cart.clear();
    } catch {
      alert('Order placement failed. Please verify your tray.');
    } finally {
      setBusy(false);
    }
  }

  // Fruitful Transaction Result: Genuine Thermal Bill Output
  if (confirmedBill) {
    return (
      <main className="max-w-md mx-auto px-4 py-8 space-y-6 bg-white">
        <div className="thermal-receipt-paper bg-white border-2 border-black">
          <div className="paperclip-graphic" />
          <div className="text-center">
            <img src="/byte-logo.png" alt="BYTE" className="h-6 w-auto mx-auto mb-1" />
            <div className="font-bold text-xs tracking-wider">ORDER RECEIPT</div>
            <div className="text-[10px] text-zinc-600">DJSCE · VILE PARLE (W), MUMBAI</div>
          </div>

          <div className="receipt-dash" />

          <div className="flex justify-between text-xs">
            <span>RECEIPT NUMBER:</span>
            <b>#{confirmedBill.order_number}</b>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>CUSTOMER:</span>
            <b>KEERTHI</b>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>CANTEEN:</span>
            <b>{confirmedBill.outlet_name}</b>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>PICKUP COUNTER:</span>
            <b className="bg-[#F9E900] text-black border border-black px-1.5">{confirmedBill.pickup_counter}</b>
          </div>

          <div className="receipt-dash" />

          <div className="space-y-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>ITEMS</span>
              <span>TOTAL</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>FOOD ORDER LINES</span>
              <span>₹{Number(confirmedBill.total).toFixed(2)}</span>
            </div>
          </div>

          <div className="receipt-dash" />

          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL PAID:</span>
            <span>₹{Number(confirmedBill.total).toFixed(2)}</span>
          </div>

          <div className="barcode-render" />

          <div className="mt-4 p-3 bg-white border-2 border-black text-center">
            <div className="w-24 h-24 mx-auto bg-white border border-black p-1 grid place-items-center">
              <QrCode size={80} className="text-black" />
            </div>
            <div className="font-mono text-[9px] font-bold mt-1 tracking-widest">
              TOKEN #{confirmedBill.order_number}
            </div>
            <div className="text-[9px] text-zinc-500">
              PRESENT AT COUNTER FOR INSTANT COLLECTION
            </div>
          </div>

          <div className="text-center text-[10px] text-zinc-500 mt-4 leading-relaxed">
            THANK YOU FOR EATING WITH BYTE.<br />
            NO QUEUES. NO FRICTION.
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn btn-white flex-1">
            <Printer size={15} /> Print Bill
          </button>
          <button onClick={() => navigate('/orders')} className="btn btn-yellow flex-1">
            Track Status
          </button>
        </div>
      </main>
    );
  }

  // Tray View
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-3xl font-extrabold">Your Tray.</h1>
        <p className="text-xs text-zinc-500 mt-1">Customer: KEERTHI · DJSCE Campus Network</p>
      </div>

      {cart.lines.length === 0 ? (
        <div className="clean-card p-12 text-center bg-white border-2 border-black">
          <ShoppingBag size={40} className="mx-auto text-zinc-400 mb-3" />
          <h2 className="text-xl font-bold font-mono">YOUR TRAY IS EMPTY</h2>
          <p className="text-xs text-zinc-500 my-4">Pick something delicious from the menu.</p>
          <Link to="/menu" className="btn btn-yellow text-xs">
            Browse Menu
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="clean-card p-0 divide-y-2 divide-black bg-white border-2 border-black">
            {cart.lines.map(line => (
              <div key={line.food.id} className="p-4 flex items-center justify-between gap-4 bg-white">
                <div>
                  <h3 className="font-bold text-sm">{line.food.name}</h3>
                  <div className="font-mono text-xs text-zinc-500">
                    ₹{line.food.price} each · {line.food.prep_minutes} min prep
                  </div>
                </div>

                <div className="flex items-center border border-black bg-white">
                  <button onClick={() => cart.setQty(line.food.id, line.quantity - 1)} className="p-1.5">
                    <Minus size={13} />
                  </button>
                  <span className="font-mono font-bold px-3 text-xs">{line.quantity}</span>
                  <button onClick={() => cart.setQty(line.food.id, line.quantity + 1)} className="p-1.5">
                    <Plus size={13} />
                  </button>
                </div>

                <div className="font-mono font-bold text-sm min-w-[60px] text-right">
                  ₹{(line.food.price * line.quantity).toFixed(0)}
                </div>
              </div>
            ))}
          </div>

          {/* Configuration options */}
          <div className="clean-card p-6 space-y-4 bg-white border-2 border-black">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">PICKUP TIME</h3>
            <select
              value={pickupSlot}
              onChange={e => setPickupSlot(e.target.value)}
              className="w-full p-2.5 border-2 border-black bg-white font-mono text-xs"
            >
              <option value="Immediate (~10 mins)">Immediate (~10 mins preparation)</option>
              <option value="1:15 PM Lunch Break">1:15 PM Lunch Break</option>
              <option value="1:45 PM Recess Slot">1:45 PM Recess Slot</option>
              <option value="3:30 PM Evening Break">3:30 PM Evening Break</option>
            </select>

            <h3 className="font-mono text-xs font-bold uppercase tracking-wider pt-2">PAYMENT MODE</h3>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <button
                type="button"
                onClick={() => setPaymentChoice('upi')}
                className={`p-3 border-2 border-black text-left ${
                  paymentChoice === 'upi' ? 'bg-[#F9E900] text-black font-bold' : 'bg-white text-black'
                }`}
              >
                UPI / Digital Campus
              </button>
              <button
                type="button"
                onClick={() => setPaymentChoice('counter')}
                className={`p-3 border-2 border-black text-left ${
                  paymentChoice === 'counter' ? 'bg-[#F9E900] text-black font-bold' : 'bg-white text-black'
                }`}
              >
                Cash at Counter
              </button>
            </div>

            <div className="pt-4 border-t-2 border-black flex justify-between items-center font-mono">
              <span className="font-bold text-base">TOTAL BILL:</span>
              <span className="font-extrabold text-2xl">₹{cart.total().toFixed(0)}</span>
            </div>

            <button
              onClick={placeFruitfulOrder}
              disabled={busy}
              className="btn btn-yellow w-full py-3.5 text-xs font-bold"
            >
              {busy ? 'PROCESSING TRANSACTION...' : 'PLACE ORDER & GENERATE BILL'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// SCREEN 08: FRUITFUL TRANSACTIONS — TABLE RESERVATION
// ==========================================
function TableReservation() {
  const queryClient = useQueryClient();
  const [selectedOutletId, setSelectedOutletId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  });
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [partySize, setPartySize] = useState<number>(2);
  const [duration, setDuration] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [bookingPass, setBookingPass] = useState<any>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);

  // Load Outlets
  const outletsQuery = useQuery({
    queryKey: ['outlets'],
    queryFn: async () => (await api.get<Outlet[]>('/outlets')).data,
  });
  const outlets = safeArray<Outlet>(outletsQuery.data);

  // Load user's active reservations so state persists across page refreshes
  const myReservationsQuery = useQuery({
    queryKey: ['my-reservations'],
    queryFn: async () => (await api.get<any[]>('/reservations/mine')).data,
  });
  const myReservations = safeArray<any>(myReservationsQuery.data);
  const currentPass = bookingPass || myReservations.find(r => r.status === 'CONFIRMED' || r.reservation_status === 'CONFIRMED');

  // Load Tables for the selected outlet, date, time slot, duration
  const tablesQuery = useQuery({
    queryKey: ['tables', selectedOutletId, selectedDate, selectedTime, duration],
    queryFn: async () => (await api.get<Table[]>('/tables', {
      params: {
        outlet_id: selectedOutletId,
        reservation_date: selectedDate,
        start_time: selectedTime,
        duration_minutes: duration,
      },
    })).data,
  });
  const tables = safeArray<Table>(tablesQuery.data);

  function autoFindTable() {
    setReservationError(null);
    const candidate = tables.find(t => t.status === 'available' && t.capacity >= partySize);
    if (candidate) {
      setSelectedTable(candidate);
    } else {
      setReservationError(`No open table with at least ${partySize} seats at ${selectedTime}. Try another time slot or party size.`);
    }
  }

  async function reserveTable(tId: number) {
    if (!selectedTable) return;
    if (partySize > selectedTable.capacity) {
      setReservationError(`Party size (${partySize}) exceeds table capacity (${selectedTable.capacity} seats).`);
      return;
    }

    setBusy(true);
    setReservationError(null);
    try {
      const res = await api.post(`/tables/${tId}/reserve`, {
        outlet_id: selectedOutletId,
        reservation_date: selectedDate,
        start_time: selectedTime,
        duration_minutes: duration,
        party_size: partySize,
      });

      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      const resData = res.data?.data || res.data;
      setBookingPass(resData?.table || resData);
      setSelectedTable(null);
    } catch (err: any) {
      const msg = err.friendlyMessage || err.response?.data?.message || err.response?.data?.error?.message || 'Could not complete table reservation.';
      setReservationError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function cancelTable(targetId: number) {
    setBusy(true);
    try {
      await api.post(`/tables/${targetId}/cancel`, {});
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setBookingPass(null);
      setReservationError(null);
    } catch (err: any) {
      alert(err.friendlyMessage || 'Could not cancel reservation.');
    } finally {
      setBusy(false);
    }
  }

  const selectedOutlet = outlets.find(o => o.id === selectedOutletId) || outlets[0];
  const timeSlots = ['11:30', '12:00', '12:20', '12:40', '13:00', '13:20', '13:40', '14:00', '14:20', '15:00', '16:00', '17:00'];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <div className="stamp-mumbai mb-2">
            <span>DINING HALL · {selectedOutlet?.name?.toUpperCase() || 'DJSCE CENTRAL CANTEEN'}</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Table Reservation.</h1>
          <p className="font-mono text-xs text-zinc-500 mt-1">Reserve physical seating in advance with real-time overlap prevention.</p>
        </div>

        <button onClick={autoFindTable} className="btn btn-yellow text-xs">
          <Sparkles size={14} /> Auto-Find Table ({partySize} Seats)
        </button>
      </div>

      {/* Error Alert Banner */}
      {reservationError && (
        <div className="p-4 border-2 border-black bg-red-50 text-red-700 flex items-start justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
            <span>{reservationError}</span>
          </div>
          <button onClick={() => setReservationError(null)} className="icon-button-clean text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active Booking Pass (Fruitful result & persisted state) */}
      {currentPass && (
        <div className="clean-card bg-[#F9E900] text-black border-2 border-black p-6 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                CONFIRMED SEATING PASS {currentPass.reservation_number ? `· REF: ${currentPass.reservation_number}` : ''}
              </span>
              <h3 className="text-2xl font-black">TABLE #{currentPass.table_number || currentPass.table?.table_number}</h3>
            </div>
            <button
              onClick={() => cancelTable(currentPass.table_id || currentPass.table?.id || currentPass.id)}
              disabled={busy}
              className="btn btn-white btn-sm"
            >
              Release Table
            </button>
          </div>
          <div className="font-mono text-xs grid sm:grid-cols-4 gap-2 border-t border-black pt-2">
            <div>CANTEEN: <b>{currentPass.outlet_name || selectedOutlet?.name}</b></div>
            <div>DATE: <b>{currentPass.reservation_date || selectedDate}</b></div>
            <div>SLOT: <b>{currentPass.start_time || currentPass.expires_at || selectedTime} ({currentPass.duration_minutes || duration} min)</b></div>
            <div>STATUS: <b className="text-[#2A00FF]">CONFIRMED</b></div>
          </div>
        </div>
      )}

      {/* 1. Outlet Selector Tabs */}
      <div className="space-y-1">
        <label className="block font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider">SELECT CAMPUS OUTLET</label>
        <div className="flex flex-wrap gap-2">
          {outlets.map(o => (
            <button
              key={o.id}
              onClick={() => { setSelectedOutletId(o.id); setSelectedTable(null); setReservationError(null); }}
              className={`px-3 py-1.5 border-2 border-black font-mono text-xs font-bold ${
                selectedOutletId === o.id ? 'bg-[#2A00FF] text-white' : 'bg-white text-black'
              }`}
            >
              {o.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Date & Time Slot Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-2 border-black bg-zinc-50 font-mono text-xs">
        <div>
          <label className="block font-bold text-[10px] text-zinc-600 uppercase mb-1">RESERVATION DATE</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setSelectedTable(null); setReservationError(null); }}
            className="w-full p-2 border border-black bg-white font-bold font-mono text-xs"
          />
        </div>

        <div>
          <label className="block font-bold text-[10px] text-zinc-600 uppercase mb-1">START TIME</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={selectedTime}
              onChange={e => { setSelectedTime(e.target.value); setSelectedTable(null); setReservationError(null); }}
              className="w-full p-2 border border-black bg-white font-bold font-mono text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-[10px] text-zinc-600 uppercase mb-1">SLOT DURATION</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDuration(15)}
              className={`p-2 border border-black font-bold text-center ${duration === 15 ? 'bg-[#F9E900] text-black' : 'bg-white text-black'}`}
            >
              15 Min
            </button>
            <button
              onClick={() => setDuration(20)}
              className={`p-2 border border-black font-bold text-center ${duration === 20 ? 'bg-[#F9E900] text-black' : 'bg-white text-black'}`}
            >
              20 Min
            </button>
          </div>
        </div>
      </div>

      {/* Quick Time Slots Strip */}
      <div className="space-y-1">
        <label className="block font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider">QUICK TIME SLOTS</label>
        <div className="flex gap-2 overflow-x-auto pb-1 font-mono text-xs">
          {timeSlots.map(slot => (
            <button
              key={slot}
              onClick={() => { setSelectedTime(slot); setSelectedTable(null); setReservationError(null); }}
              className={`px-3 py-1 border border-black font-bold whitespace-nowrap ${
                selectedTime === slot ? 'bg-[#2A00FF] text-white' : 'bg-white text-black'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Party Size Filter and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs border-y-2 border-black py-3 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[10px]">PARTY SIZE:</span>
          {[2, 4, 6].map(n => (
            <button
              key={n}
              onClick={() => { setPartySize(n); setReservationError(null); }}
              className={`px-3 py-1 border border-black font-bold ${
                partySize === n ? 'bg-[#2A00FF] text-white' : 'bg-white text-black'
              }`}
            >
              {n} Guests
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#F9E900] border border-black inline-block" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#2A00FF] border border-black inline-block" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-white border border-[#DD1C1A] inline-block" />
            <span className="text-[#DD1C1A]">Occupied</span>
          </div>
        </div>
      </div>

      {/* Floor Plan Grid */}
      <div className="table-grid-stage bg-white">
        {tables.map(table => (
          <div
            key={table.id}
            onClick={() => { setSelectedTable(table); setReservationError(null); }}
            className={`table-slot-block ${table.status}`}
          >
            <div className="font-mono text-[9px] font-bold opacity-75">{table.capacity} SEATS</div>
            <div className="font-mono text-2xl font-black my-1">{table.table_number}</div>
            <div className="font-mono text-[9px] font-bold uppercase">{table.status}</div>
          </div>
        ))}
      </div>

      {/* Table Booking Modal */}
      {selectedTable && (
        <div className="byte-modal-backdrop" onClick={() => setSelectedTable(null)}>
          <div className="byte-modal-card p-6 space-y-4 bg-white" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-xl font-bold font-mono">TABLE #{selectedTable.table_number}</h3>
                <span className="font-mono text-[10px] text-zinc-500">{selectedOutlet?.name}</span>
              </div>
              <button onClick={() => setSelectedTable(null)} className="icon-button-clean">
                <X size={16} />
              </button>
            </div>

            <div className="font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span>SEATING CAPACITY:</span>
                <b>{selectedTable.capacity} PERSONS</b>
              </div>
              <div className="flex justify-between">
                <span>REQUESTED GUESTS:</span>
                <b className={partySize > selectedTable.capacity ? 'text-red-600 font-bold' : ''}>
                  {partySize} GUESTS
                </b>
              </div>
              <div className="flex justify-between">
                <span>DATE &amp; TIME:</span>
                <b>{selectedDate} · {selectedTime} ({duration} min)</b>
              </div>
              <div className="flex justify-between">
                <span>ZONE:</span>
                <b>{selectedTable.location}</b>
              </div>
              <div className="flex justify-between">
                <span>SLOT STATUS:</span>
                <b className="uppercase">{selectedTable.status}</b>
              </div>
            </div>

            {partySize > selectedTable.capacity && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-700 font-mono text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>Party size ({partySize}) exceeds table capacity ({selectedTable.capacity} seats). Please pick a larger table or reduce party size.</span>
              </div>
            )}

            {selectedTable.status === 'available' ? (
              <div className="space-y-4 pt-2">
                <button
                  onClick={() => reserveTable(selectedTable.id)}
                  disabled={busy || partySize > selectedTable.capacity}
                  className={`btn btn-yellow w-full py-3 text-xs font-bold ${
                    partySize > selectedTable.capacity ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {busy ? 'CONFIRMING TRANSACTION...' : `CONFIRM ${duration}-MIN RESERVATION`}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-zinc-50 border border-black text-center font-mono text-xs text-zinc-600">
                This table is currently <b>{selectedTable.status}</b> for the slot <b>{selectedTime}</b>. Please select another table or try another time slot.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// SCREEN 06 & 07: LIVE TRACKING & RECEIPTS
// ==========================================
function OrdersBoard({ user }: { user: User | null }) {
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => (await api.get<Order[]>('/orders/mine')).data,
    enabled: !!user,
    refetchInterval: 5000,
  });

  const orders = safeArray<Order>(ordersQuery.data);
  const activeOrder = orders.find(o => o.status === 'PLACED' || o.status === 'PREPARING' || o.status === 'READY') || orders[0];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Orders &amp; Tracking.</h1>
        <p className="text-xs text-zinc-500 mt-1">Student: KEERTHI · DJSCE Campus Dining Network</p>
      </div>

      {/* Active Order Live Progress Tracker */}
      {activeOrder && (
        <div className="clean-card p-6 space-y-6 bg-white border-2 border-black">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b-2 border-black pb-4">
            <div>
              <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase">LIVE PREPARATION</span>
              <h2 className="text-2xl font-black">ORDER #{activeOrder.order_number}</h2>
              <div className="font-mono text-xs text-zinc-500">{activeOrder.outlet_name} · {activeOrder.pickup_counter}</div>
            </div>

            <div className="p-3 bg-[#F9E900] text-black border-2 border-black text-center font-mono">
              <span className="text-[9px] block font-bold">ESTIMATED STATUS</span>
              <b className="text-sm">{activeOrder.status === 'READY' ? 'READY AT COUNTER' : activeOrder.status === 'PREPARING' ? 'READY IN ~5 MINS' : 'IN QUEUE'}</b>
            </div>
          </div>

          {/* 4-Step Progress Timeline from Styleboard */}
          <div className="space-y-4 max-w-md mx-auto pt-2">
            <div className="timeline-step">
              <div className={`timeline-bullet ${activeOrder.status ? 'done' : ''}`}>
                <Check size={14} />
              </div>
              <div>
                <div className="font-bold text-sm">Order Placed</div>
                <div className="font-mono text-xs text-zinc-500">Transmitted to kitchen POS</div>
              </div>
            </div>

            <div className="timeline-step">
              <div className={`timeline-bullet ${activeOrder.status === 'PREPARING' || activeOrder.status === 'READY' || activeOrder.status === 'COMPLETED' ? 'active' : ''}`}>
                <Clock size={14} />
              </div>
              <div>
                <div className="font-bold text-sm">Preparing</div>
                <div className="font-mono text-xs text-zinc-500">Cooked fresh on the counter</div>
              </div>
            </div>

            <div className="timeline-step">
              <div className={`timeline-bullet ${activeOrder.status === 'READY' || activeOrder.status === 'COMPLETED' ? 'done' : ''}`}>
                <QrCode size={14} />
              </div>
              <div>
                <div className="font-bold text-sm">Ready for Pickup</div>
                <div className="font-mono text-xs text-zinc-500">Counter 02 express window</div>
              </div>
            </div>

            <div className="timeline-step">
              <div className={`timeline-bullet ${activeOrder.status === 'COMPLETED' ? 'done' : ''}`}>
                <CheckCircle2 size={14} />
              </div>
              <div>
                <div className="font-bold text-sm">Delivered</div>
                <div className="font-mono text-xs text-zinc-500">Token verified</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Receipts Archive */}
      <div className="space-y-4">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-500">
          ORDER RECEIPT ARCHIVE
        </h3>

        {orders.map(order => (
          <div
            key={order.id}
            className="clean-card p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border-2 border-black"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm">TOKEN #{order.order_number}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 border border-black font-bold uppercase bg-white">
                  {order.status}
                </span>
              </div>
              <div className="font-mono text-xs text-zinc-500 mt-1">
                {safeArray<any>(order.items).map(i => `${i.quantity} × ${i.name}`).join(', ')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-bold">₹{Number(order.total).toFixed(0)}</span>
              <button
                onClick={() => setSelectedReceipt(order)}
                className="btn btn-white btn-sm"
              >
                View Bill
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill Modal */}
      {selectedReceipt && (
        <div className="byte-modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="byte-modal-card p-6 bg-white border-2 border-black" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setSelectedReceipt(null)} className="icon-button-clean">
                <X size={16} />
              </button>
            </div>

            <div className="thermal-receipt-paper bg-white border-2 border-black">
              <div className="paperclip-graphic" />
              <div className="text-center font-bold text-sm">BYTE ORDER BILL</div>
              <div className="text-center text-[10px] text-zinc-500">DJSCE · VILE PARLE (W), MUMBAI</div>
              <div className="receipt-dash" />
              <div className="flex justify-between text-xs">
                <span>ORDER:</span>
                <b>#{selectedReceipt.order_number}</b>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>STUDENT:</span>
                <b>KEERTHI</b>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>TOTAL:</span>
                <b>₹{Number(selectedReceipt.total).toFixed(2)}</b>
              </div>
              <div className="receipt-dash" />
              <div className="space-y-1 text-xs">
                {safeArray<any>(selectedReceipt.items).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.quantity} × {item.name}</span>
                  </div>
                ))}
              </div>
              <div className="barcode-render" />
              <div className="text-center text-[10px] text-zinc-500 mt-2">THANK YOU FOR EATING WITH BYTE!</div>
            </div>

            <div className="mt-4 flex justify-center">
              <button onClick={() => window.print()} className="btn btn-yellow btn-sm">
                <Printer size={14} /> Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// SCREEN: REWARDS & POINTS (KEERTHI'S POINTS)
// ==========================================
function RewardsScreen() {
  const [points, setPoints] = useState(120);
  const [redeemed, setRedeemed] = useState(false);

  function redeemDiscount() {
    if (points >= 50) {
      setPoints(points - 50);
      setRedeemed(true);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Rewards &amp; Perks.</h1>
        <p className="text-xs text-zinc-500 mt-1">Account: KEERTHI · DJSCE Campus Dining Network</p>
      </div>

      <div className="clean-card bg-[#F9E900] text-black border-2 border-black p-8 text-center space-y-3">
        <span className="font-mono text-xs font-bold uppercase tracking-wider">AVAILABLE BALANCE</span>
        <div className="text-5xl font-black">{points} BYTE POINTS</div>
        <p className="text-xs max-w-sm mx-auto">
          Earn 10 points on every campus meal order. 50 points = ₹30 Instant Food Voucher.
        </p>
        <button
          onClick={redeemDiscount}
          disabled={redeemed || points < 50}
          className="btn btn-white text-xs mt-2"
        >
          {redeemed ? 'VOUCHER APPLIED (₹30 OFF)' : 'REDEEM 50 POINTS FOR ₹30 OFF'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="clean-card p-5 space-y-2 bg-white border-2 border-black">
          <div className="font-mono text-[10px] font-bold text-[#2A00FF]">ACTIVE PROMOTION</div>
          <h3 className="font-bold text-base">FREE DRINK ON ORDERS &gt; ₹150</h3>
          <p className="text-xs text-zinc-500">Automatically added to cart when ordering combos.</p>
        </div>

        <div className="clean-card p-5 space-y-2 bg-white border-2 border-black">
          <div className="font-mono text-[10px] font-bold text-[#DD1C1A]">MEAL STREAK</div>
          <h3 className="font-bold text-base">5 ORDERS = 1 FREE MEAL</h3>
          <p className="text-xs text-zinc-500">Current progress for KEERTHI: 3 completed campus meals.</p>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// SCREEN: CANTEENS LIVE STATUS
// ==========================================
function CanteenStatusView() {
  const status = useQuery({
    queryKey: ['canteen-status'],
    queryFn: async () => (await api.get<CanteenStatus>('/canteen-status')).data,
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">DJSCE Canteens.</h1>
        <p className="text-xs text-zinc-500 mt-1">Live queue status and rush estimations across DJSCE campus.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {safeArray<any>(status.data?.outlets).map(o => (
          <div key={o.id} className="clean-card p-6 space-y-4 bg-white border-2 border-black">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold">{o.name}</h3>
              <span className="font-mono text-[10px] px-2 py-0.5 border border-black font-bold bg-white">
                {o.crowd_level}
              </span>
            </div>

            <div className="font-mono text-xs text-zinc-500">
              <MapPin size={12} className="inline mr-1" />
              {o.location}
            </div>

            <div className="border-t border-dashed pt-3 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span>ESTIMATED WAIT:</span>
                <b>{o.avg_wait_min} MINS</b>
              </div>
            </div>

            <Link to="/menu" className="btn btn-yellow w-full text-xs">
              View Menu
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

// ==========================================
// SCREEN: KITCHEN OPERATIONS TERMINAL
// ==========================================
function KitchenTerminal() {
  const qc = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['vendor-orders'],
    queryFn: async () => (await api.get<Order[]>('/vendor/orders')).data,
    refetchInterval: 5000,
  });

  const orders = safeArray<Order>(ordersQuery.data);

  async function updateStatus(id: number, s: string) {
    await api.patch(`/vendor/orders/${id}/status`, { status: s });
    qc.invalidateQueries({ queryKey: ['vendor-orders'] });
    qc.invalidateQueries({ queryKey: ['my-orders'] });
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Kitchen Operations.</h1>
        <p className="text-xs text-zinc-500 mt-1">DJSCE Kitchen queue dispatch and preparation management.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {orders.map(o => (
          <div key={o.id} className="clean-card p-5 space-y-3 bg-white border-2 border-black">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-sm font-bold">TOKEN #{o.order_number}</span>
                <div className="font-mono text-xs text-zinc-500">{o.pickup_counter}</div>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 border border-black bg-white">
                {o.status}
              </span>
            </div>

            <div className="border-y border-dashed py-2 font-mono text-xs space-y-1">
              {safeArray<any>(o.items).map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.quantity} × {i.name}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {o.status === 'PLACED' && (
                <button onClick={() => updateStatus(o.id, 'PREPARING')} className="btn btn-yellow btn-sm">
                  Start Prep
                </button>
              )}
              {o.status === 'PREPARING' && (
                <button onClick={() => updateStatus(o.id, 'READY')} className="btn btn-blue btn-sm">
                  Mark Ready
                </button>
              )}
              {o.status === 'READY' && (
                <button onClick={() => updateStatus(o.id, 'COMPLETED')} className="btn btn-white btn-sm">
                  Confirm Pickup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ==========================================
// SCREEN: PROFILE & DOSSIER (KEERTHI)
// ==========================================
function ProfileScreen({ user }: { user: User | null }) {
  if (!user) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 bg-white">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Campus Profile.</h1>
        <p className="text-xs text-zinc-500 mt-1">DJSCE Student Credential and dining stats.</p>
      </div>

      <div className="clean-card p-6 space-y-4 bg-white border-2 border-black">
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <span className="font-mono text-[10px] text-zinc-500 uppercase">DJSCE STUDENT CREDENTIAL</span>
            <h2 className="text-2xl font-bold mt-1">KEERTHI</h2>
            <div className="font-mono text-xs text-[#2A00FF] font-bold">DJSCE-2024-CS089</div>
          </div>
          <span className="font-mono text-xs font-bold px-2 py-1 border border-black uppercase bg-white">
            {user.role}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <span className="text-zinc-500 block text-[10px]">CAMPUS EMAIL</span>
            <b>{user.email}</b>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">LOYALTY REWARDS</span>
            <b>120 BYTE POINTS</b>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">CAMPUS</span>
            <b>DJSCE, MUMBAI</b>
          </div>
          <div>
            <span className="text-zinc-500 block text-[10px]">ACCOUNT STATUS</span>
            <b className="text-green-600">VERIFIED ACTIVE</b>
          </div>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// SCREEN: ADMIN MANAGEMENT & CSV IMPORT (Part K & L)
// ==========================================
function AdminScreen() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'csv'>('metrics');

  // Analytics Query
  const analyticsQuery = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => (await api.get<any>('/admin/analytics')).data,
  });

  // Users Query
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<any[]>('/admin/users')).data,
  });

  // CSV Import State
  const [entityType, setEntityType] = useState<'menu_items' | 'categories' | 'users'>('menu_items');
  const [csvContent, setCsvContent] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Template loaders
  function loadTemplate(type: 'menu_items' | 'categories' | 'users') {
    setEntityType(type);
    setPreviewResult(null);
    setImportStatus(null);

    if (type === 'menu_items') {
      setCsvContent(`outlet_id,category_id,item_name,description,price,food_type,preparation_time,stock_quantity
1,1,"Chole Kulche Combo","Spiced Amritsari chole with 2 fluffy butter kulchas",95,VEG,10,35
2,4,"Rava Masala Dosa","Crispy semolina crepe tempered with cumin and green chillies",75,VEG,12,40
3,6,"Iced Caramel Macchiato","Espresso over cold milk and caramel drizzle",70,VEG,4,50`);
    } else if (type === 'categories') {
      setCsvContent(`outlet_id,category_name,description,display_order
1,"Live Griddle Specials","Tawa fried campus items",4
2,"Filter Coffee & Sweets","Traditional South Indian beverages and desserts",3
3,"Fresh Pressed Juices","Seasonal vitamin boosts",3`);
    } else if (type === 'users') {
      setCsvContent(`full_name,email,phone,user_category,operational_role
"Aarav Mehta","aarav.mehta@example.com","+91 98200 11111",STUDENT,USER
"Dr. Ananya Roy","ananya.roy@example.com","+91 98200 22222",FACULTY,USER
"Subhash Canteen Staff","subhash.staff@example.com","+91 98200 33333",NON_TEACHING_STAFF,OUTLET_STAFF`);
    }
  }

  async function handlePreview() {
    if (!csvContent.trim()) {
      alert('Please enter or paste CSV content.');
      return;
    }
    setBusy(true);
    setImportStatus(null);
    try {
      const res = await api.post('/admin/csv/preview', {
        entity_type: entityType,
        csv_content: csvContent,
      });
      setPreviewResult(res.data);
    } catch (err: any) {
      alert(err.friendlyMessage || 'CSV validation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteImport() {
    if (!csvContent.trim()) return;
    setBusy(true);
    try {
      const res = await api.post('/admin/csv/import', {
        entity_type: entityType,
        csv_content: csvContent,
      });
      setImportStatus(`Success: ${res.data?.message || 'Records imported.'}`);
      setPreviewResult(null);
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['all-foods'] });
      qc.invalidateQueries({ queryKey: ['outlets'] });
    } catch (err: any) {
      alert(err.friendlyMessage || 'CSV transactional import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: number, role: string) {
    try {
      await api.patch(`/admin/users/${userId}`, { operational_role: role });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    } catch {
      alert('Could not update role.');
    }
  }

  const metrics = analyticsQuery.data || {
    total_orders: 0,
    total_revenue_inr: 0,
    active_users: 0,
    total_outlets: 0,
    active_menu_items: 0,
    average_prep_time_min: 10,
  };

  const users = safeArray<any>(usersQuery.data);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 bg-white">
      <div className="border-b-2 border-black pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <div className="stamp-mumbai mb-2">
            <span>CENTRAL COMMAND · DJSCE CAMPUS ADMIN</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Platform Administration.</h1>
        </div>

        <button
          onClick={() => {
            analyticsQuery.refetch();
            usersQuery.refetch();
          }}
          className="btn btn-white btn-sm"
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-black font-mono text-xs">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-5 py-2.5 font-bold border-b-2 ${
            activeTab === 'metrics'
              ? 'border-b-4 border-b-[#2A00FF] text-[#2A00FF] bg-zinc-50'
              : 'border-transparent text-black'
          }`}
        >
          Overview &amp; Metrics
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 font-bold border-b-2 ${
            activeTab === 'users'
              ? 'border-b-4 border-b-[#2A00FF] text-[#2A00FF] bg-zinc-50'
              : 'border-transparent text-black'
          }`}
        >
          Campus Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-5 py-2.5 font-bold border-b-2 ${
            activeTab === 'csv'
              ? 'border-b-4 border-b-[#2A00FF] text-[#2A00FF] bg-zinc-50'
              : 'border-transparent text-black'
          }`}
        >
          CSV Import System
        </button>
      </div>

      {/* TAB 1: METRICS */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="clean-card p-5 bg-white border-2 border-black">
              <span className="font-mono text-[10px] text-zinc-500 uppercase block">TOTAL MEALS SERVED</span>
              <div className="font-mono text-3xl font-black mt-2">{metrics.total_orders}</div>
              <span className="font-mono text-[10px] text-zinc-500 mt-1 block">Live across campus</span>
            </div>

            <div className="clean-card p-5 bg-white border-2 border-black">
              <span className="font-mono text-[10px] text-zinc-500 uppercase block">TOTAL REVENUE (INR)</span>
              <div className="font-mono text-3xl font-black mt-2 text-[#2A00FF]">₹{Number(metrics.total_revenue_inr).toFixed(0)}</div>
              <span className="font-mono text-[10px] text-zinc-500 mt-1 block">Zero commission lost</span>
            </div>

            <div className="clean-card p-5 bg-white border-2 border-black">
              <span className="font-mono text-[10px] text-zinc-500 uppercase block">ACTIVE USERS</span>
              <div className="font-mono text-3xl font-black mt-2">{metrics.active_users}</div>
              <span className="font-mono text-[10px] text-zinc-500 mt-1 block">Students &amp; Faculty</span>
            </div>

            <div className="clean-card p-5 bg-white border-2 border-black">
              <span className="font-mono text-[10px] text-zinc-500 uppercase block">CANTEEN OUTLETS</span>
              <div className="font-mono text-3xl font-black mt-2">{metrics.total_outlets}</div>
              <span className="font-mono text-[10px] text-zinc-500 mt-1 block">DJSCE Active Kitchens</span>
            </div>
          </div>

          <div className="clean-card p-6 bg-white border-2 border-black font-mono text-xs space-y-2">
            <h3 className="font-bold text-sm">CAMPUS OPERATIONAL PARAMETERS</h3>
            <div className="flex justify-between border-b pb-2">
              <span className="text-zinc-500">PEAK RUSH HOURS:</span>
              <b>{metrics.peak_ordering_window || '12:45 PM – 01:30 PM'}</b>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-zinc-500">AVERAGE DISPATCH WAIT:</span>
              <b>~{metrics.average_prep_time_min || 10} MINS</b>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-zinc-500">DATABASE STATUS:</span>
              <b className="text-green-600">SQLITE RELATIONAL WAL (LOCAL PERSISTENT)</b>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ACTIVE MENU DIRECTORY:</span>
              <b>{metrics.active_menu_items} ITEMS</b>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="clean-card p-0 overflow-x-auto bg-white border-2 border-black">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-zinc-100 border-b-2 border-black">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">FULL NAME</th>
                <th className="p-3">EMAIL</th>
                <th className="p-3">CATEGORY</th>
                <th className="p-3">OPERATIONAL ROLE</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">ROLE ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y border-black">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="p-3 font-bold">#{u.id}</td>
                  <td className="p-3 font-bold">{u.full_name || u.name}</td>
                  <td className="p-3 text-zinc-600">{u.email}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 border border-black text-[10px] bg-white">
                      {u.user_category || 'STUDENT'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 font-bold text-[10px] border border-black ${
                      (u.operational_role || u.role) === 'ADMIN' ? 'bg-[#2A00FF] text-white' :
                      (u.operational_role || u.role) === 'VENDOR' ? 'bg-[#F9E900] text-black' : 'bg-white text-black'
                    }`}>
                      {u.operational_role || u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-green-600 font-bold">{u.account_status || 'ACTIVE'}</span>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.operational_role || u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="p-1 border border-black bg-white text-[10px] font-mono"
                    >
                      <option value="USER">USER</option>
                      <option value="VENDOR">VENDOR</option>
                      <option value="OUTLET_STAFF">OUTLET_STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CSV IMPORT ENGINE */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div className="clean-card p-6 bg-white border-2 border-black space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase">BATCH CSV IMPORT TOOL (PART L)</h3>
                <p className="text-xs text-zinc-500">
                  Import campus entities transactionally with header validation, duplicate checking, and dry-run preview.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadTemplate('menu_items')}
                  className={`btn btn-sm ${entityType === 'menu_items' ? 'btn-yellow' : 'btn-white'}`}
                >
                  Menu Items Template
                </button>
                <button
                  onClick={() => loadTemplate('categories')}
                  className={`btn btn-sm ${entityType === 'categories' ? 'btn-yellow' : 'btn-white'}`}
                >
                  Categories Template
                </button>
                <button
                  onClick={() => loadTemplate('users')}
                  className={`btn btn-sm ${entityType === 'users' ? 'btn-yellow' : 'btn-white'}`}
                >
                  Users Template
                </button>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold mb-2">
                TARGET ENTITY: <span className="text-[#2A00FF] uppercase">{entityType}</span>
              </label>
              <textarea
                value={csvContent}
                onChange={e => {
                  setCsvContent(e.target.value);
                  setPreviewResult(null);
                  setImportStatus(null);
                }}
                rows={7}
                placeholder="Paste RFC 4180 CSV with headers or click a template above..."
                className="w-full p-3 font-mono text-xs border-2 border-black bg-zinc-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={busy || !csvContent.trim()}
                className="btn btn-white text-xs font-bold"
              >
                {busy ? 'VALIDATING...' : '1. VALIDATE & PREVIEW CSV'}
              </button>
              {previewResult && previewResult.valid && (
                <button
                  onClick={handleExecuteImport}
                  disabled={busy}
                  className="btn btn-yellow text-xs font-bold"
                >
                  {busy ? 'IMPORTING...' : `2. CONFIRM TRANSACTIONAL IMPORT (${previewResult.valid_rows_count} ROWS)`}
                </button>
              )}
            </div>

            {/* Import Status Alert */}
            {importStatus && (
              <div className="p-4 bg-green-50 border-2 border-green-600 font-mono text-xs text-green-800 flex items-center gap-2">
                <CheckCircle size={16} />
                <b>{importStatus}</b>
              </div>
            )}

            {/* Validation Preview Box */}
            {previewResult && (
              <div className={`p-4 border-2 font-mono text-xs space-y-3 ${
                previewResult.valid ? 'bg-zinc-50 border-black' : 'bg-red-50 border-[#DD1C1A]'
              }`}>
                <div className="flex justify-between items-center">
                  <b>VALIDATION REPORT: {previewResult.valid ? 'PASSED READY FOR IMPORT' : 'ERRORS DETECTED'}</b>
                  <span>
                    Valid Rows: <b>{previewResult.valid_rows_count}</b> | Invalid Rows: <b>{previewResult.invalid_rows_count}</b>
                  </span>
                </div>

                {previewResult.errors && previewResult.errors.length > 0 && (
                  <div className="space-y-1 text-[#DD1C1A]">
                    <div className="font-bold">Issues Found:</div>
                    {previewResult.errors.map((e: any, idx: number) => (
                      <div key={idx}>• Row {e.row}: {e.reason}</div>
                    ))}
                  </div>
                )}

                {previewResult.sample_rows && previewResult.sample_rows.length > 0 && (
                  <div>
                    <div className="font-bold text-zinc-500 mb-1">Preview of First {previewResult.sample_rows.length} Rows:</div>
                    <pre className="p-2 bg-white border border-black overflow-x-auto text-[11px]">
                      {JSON.stringify(previewResult.sample_rows, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// ROOT APP
// ==========================================
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isMobileFrame, setIsMobileFrame] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Keep document element background clean white
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  async function handleLogout() {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/login');
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-white grid place-items-center font-mono font-bold text-xs tracking-wider text-black">
        BYTE / CONNECTING DJSCE CAMPUS FOOD NETWORK...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Shell
        user={user}
        onLogout={handleLogout}
        isMobileFrame={isMobileFrame}
        toggleMobileFrame={() => setIsMobileFrame(!isMobileFrame)}
      >
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" />
            ) : (
              <Login
                onLogin={u => {
                  setUser(u);
                  navigate('/');
                }}
              />
            )
          }
        />
        <Route path="/" element={!user ? <Navigate to="/login" /> : <Home onSelectFood={f => setSelectedFood(f)} />} />
        <Route path="/menu" element={!user ? <Navigate to="/login" /> : <MenuCatalogue onSelectFood={f => setSelectedFood(f)} />} />
        <Route path="/cart" element={!user ? <Navigate to="/login" /> : <CartAndCheckout />} />
        <Route path="/tables" element={!user ? <Navigate to="/login" /> : <TableReservation />} />
        <Route path="/orders" element={!user ? <Navigate to="/login" /> : <OrdersBoard user={user} />} />
        <Route path="/rewards" element={!user ? <Navigate to="/login" /> : <RewardsScreen />} />
        <Route path="/status" element={!user ? <Navigate to="/login" /> : <CanteenStatusView />} />
        <Route path="/profile" element={!user ? <Navigate to="/login" /> : <ProfileScreen user={user} />} />
        <Route path="/vendor" element={!user ? <Navigate to="/login" /> : <KitchenTerminal />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminScreen /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <FoodDetailModal food={selectedFood} onClose={() => setSelectedFood(null)} />
    </Shell>
  </ErrorBoundary>
  );
}
