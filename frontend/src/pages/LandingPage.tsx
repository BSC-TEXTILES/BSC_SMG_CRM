import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  BarChart3,
  Shield,
  Clock,
  Smartphone,
  Sparkles,
  Star,
  CheckCircle2,
  ChevronRight,
  Heart,
  Eye,
  Zap,
  Globe,
  Lock,
  TrendingUp,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Wedding CRM',
    desc: 'End-to-end bridal follow-up pipeline with automated reminders and real-time status tracking.',
  },
  {
    icon: BarChart3,
    title: 'Live Dashboard',
    desc: 'Executive-grade analytics with department breakdowns, hiring funnels, and real-time KPIs.',
  },
  {
    icon: Shield,
    title: 'Security First',
    desc: 'DevTools detection, session guards, CAPTCHA login, and enterprise-grade access control.',
  },
  {
    icon: Clock,
    title: 'Attendance & Roster',
    desc: 'Shift scheduling, daily attendance logs, and visual merchandising checklists in one place.',
  },
  {
    icon: Eye,
    title: 'Feedback Engine',
    desc: 'QR-based public feedback, customer call queues, and collection dashboards.',
  },
  {
    icon: Zap,
    title: 'Real-Time Updates',
    desc: 'Socket-powered live notifications, broadcast center, and instant activity feeds.',
  },
];

const stats = [
  { value: '30+', label: 'Modules' },
  { value: '500+', label: 'Daily Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<2s', label: 'Load Time' },
];

const modules = [
  'Wedding Follow-Up CRM',
  'Candidate & Hiring Pipeline',
  'Employee Directory',
  'Footfall Tracker',
  'Cash Settlement Desk',
  'VM Checklist',
  'Daily MCheck',
  'Broadcast Center',
  'Section Allocation',
  'Offer Process',
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
                <span className="text-black font-black text-sm tracking-tight">B</span>
              </div>
              <span className="font-extrabold text-[var(--color-primary)] text-lg tracking-tight hidden sm:block">
                BSC EXCLUSIVE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/feedback-public')}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors px-3 py-2"
              >
                Feedback
              </button>
              <button
                onClick={() => navigate('/candidate-entry')}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors px-3 py-2"
              >
                Careers
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-xl hover:shadow-[var(--color-primary)]/30 hover:-translate-y-0.5"
              >
                Sign In
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[var(--color-primary)]/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] text-xs font-bold px-4 py-1.5 rounded-full mb-6 border border-[var(--color-accent)]/20">
              <Sparkles className="w-3.5 h-3.5" />
              Enterprise Retail Operations Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--text-main)] leading-tight tracking-tight">
              The Operating System for{' '}
              <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
                BSC Exclusive
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
              Unified CRM, workforce management, and retail intelligence — purpose-built for
              India's premium bridal & lifestyle retail network.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[var(--color-primary)] text-black font-bold text-base px-8 py-3.5 rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-xl shadow-[var(--color-primary)]/25 hover:shadow-2xl hover:shadow-[var(--color-primary)]/30 hover:-translate-y-0.5"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/candidate-entry')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[var(--text-main)] font-bold text-base px-8 py-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/30 transition-all"
              >
                Apply as Candidate
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-black bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="mt-1 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              Built for Retail Excellence
            </h2>
            <p className="mt-4 text-[var(--text-muted)] text-lg">
              Every module designed to eliminate fragmentation and accelerate store operations.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-[var(--border)] bg-white hover:bg-gradient-to-br hover:from-[var(--color-accent-soft)]/40 hover:to-white hover:border-[var(--color-accent)]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-primary)]/5 hover:-translate-y-1"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/8 flex items-center justify-center mb-4 group-hover:bg-[var(--color-primary)]/15 transition-colors">
                  <f.icon className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <h3 className="font-bold text-[var(--text-main)] text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules List ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight leading-tight">
                One Platform.{' '}
                <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] bg-clip-text text-transparent">
                  Every Module.
                </span>
              </h2>
              <p className="mt-4 text-[var(--text-muted)] text-lg leading-relaxed">
                Replace spreadsheets, disconnected tools, and manual tracking with a single
                integrated system your entire retail network can rely on.
              </p>
              <div className="mt-8 flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
                  <Globe className="w-4 h-4 text-[var(--color-accent)]" />
                  Multi-Location
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
                  <Lock className="w-4 h-4 text-[var(--color-accent)]" />
                  Role-Based Access
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
                  <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
                  Live Analytics
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modules.map((m, i) => (
                <div
                  key={m}
                  className="flex items-center gap-2.5 bg-white border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-main)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)]/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-[var(--green)] flex-shrink-0" />
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonial / Trust ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
            ))}
          </div>
          <blockquote className="text-xl sm:text-2xl font-semibold text-[var(--text-main)] leading-relaxed italic">
            "BSC CRM has completely transformed how we manage our bridal consultations and store operations.
            The real-time dashboards and automated follow-ups have increased our conversion rate significantly."
          </blockquote>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
              <Heart className="w-5 h-5 text-black" />
            </div>
            <div className="text-left">
              <div className="font-bold text-[var(--text-main)]">BSC Exclusive Management</div>
              <div className="text-sm text-[var(--text-muted)]">Retail Operations Team</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[#3D2B1F] p-10 sm:p-14 text-center shadow-2xl shadow-[var(--color-primary)]/20">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[var(--color-accent)]/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
                Ready to Elevate Your Operations?
              </h2>
              <p className="mt-4 text-black/90 text-lg max-w-xl mx-auto">
                Join the team that powers BSC Exclusive's retail excellence. Sign in to access
                your dashboard.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[var(--color-accent)] text-[var(--text-main)] font-bold text-base px-8 py-3.5 rounded-xl hover:bg-[var(--color-accent-hover)] transition-all shadow-lg shadow-[var(--color-accent)]/25 hover:shadow-xl hover:-translate-y-0.5"
                >
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/candidate-entry')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black/10 text-black font-bold text-base px-8 py-3.5 rounded-xl border border-black/20 hover:bg-black/20 transition-all backdrop-blur-sm"
                >
                  Join as Candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                <span className="text-black font-black text-xs">B</span>
              </div>
              <span className="font-extrabold text-[var(--color-primary)] text-sm tracking-tight">
                BSC EXCLUSIVE
              </span>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/feedback-public')}
                className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                Customer Feedback
              </button>
              <button
                onClick={() => navigate('/candidate-entry')}
                className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                Careers
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                Sign In
              </button>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              &copy; {new Date().getFullYear()} BSC Exclusive. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
