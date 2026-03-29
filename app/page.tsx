'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Eye, Github, MessagesSquare, MonitorPlay } from 'lucide-react';

import { IntakeWorkspace } from '@/components/intake/IntakeWorkspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const prototypeHighlights = [
  {
    icon: Eye,
    text: 'Reveal friction hidden in unspoken user behavior.',
  },
  {
    icon: MessagesSquare,
    text: 'Turn target persona behavior into actionable feedback.',
  },
  {
    icon: MonitorPlay,
    text: 'Test SaaS flows without stepping away from your desk.',
  },
];

export default function Home() {
  const [hasSkippedLogin, setHasSkippedLogin] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleSkipLogin = () => {
    setHasSkippedLogin(true);
  };

  if (hasSkippedLogin) {
    return (
      <main className="h-screen overflow-hidden bg-background">
        <IntakeWorkspace />
      </main>
    );
  }

  const isLogin = authMode === 'login';

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden px-4 py-6 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_transparent_40%),linear-gradient(180deg,rgba(247,239,231,0.85)_0%,rgba(239,227,214,0.55)_100%)]" />

      <section className="relative z-10 w-full max-w-[1100px] overflow-hidden rounded-[36px] border border-white/60 bg-[rgba(253,248,243,0.78)] shadow-[0_30px_80px_rgba(113,80,54,0.12)] backdrop-blur-xl">
        <div className="grid min-h-[720px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between border-b border-border/40 p-8 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
              <Image
                alt="Ascala"
                className="h-auto w-[240px] object-contain sm:w-[300px]"
                height={84}
                priority
                src="/ascala-logo.png"
                width={358}
              />

              <div className="max-w-xl space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.42em] text-[#8E6D57]">
                  Intelligent Validation Studio
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                  You&apos;re one of the first to try Ascala
                </h1>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Upload project context, chat with Ascala, generate personas, and run
                  validation simulations from a single workspace.
                </p>
              </div>

              <div className="grid w-full max-w-xl gap-3 text-left sm:grid-cols-3">
                {prototypeHighlights.map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="rounded-[24px] border border-white/70 bg-white/50 px-4 py-4 text-sm leading-6 text-muted-foreground shadow-[0_8px_30px_rgba(113,80,54,0.06)]"
                  >
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4E1D5] text-[#8E4524] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="max-w-[15ch] font-medium text-foreground/88">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-md rounded-[30px] border border-white/75 bg-white/72 p-6 shadow-[0_20px_60px_rgba(113,80,54,0.10)] backdrop-blur-md sm:p-8">
              <div className="flex items-center justify-between rounded-full border border-border/60 bg-[#F7EEE6] p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isLogin
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    !isLogin
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="mt-8 space-y-2">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {isLogin
                    ? 'Use your prototype access to open the Ascala workspace.'
                    : 'Start with a simple prototype sign-up and continue straight into the workspace.'}
                </p>
              </div>

              <form className="mt-8 space-y-4">
                {!isLogin ? (
                  <Input
                    aria-label="Full name"
                    className="h-12 rounded-2xl border-white/80 bg-white/88 px-4 shadow-[0_10px_30px_rgba(113,80,54,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
                    placeholder="Full name"
                  />
                ) : null}
                <Input
                  aria-label="Email"
                  className="h-12 rounded-2xl border-white/80 bg-white/88 px-4 shadow-[0_10px_30px_rgba(113,80,54,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
                  placeholder="Email address"
                  type="email"
                />
                <Input
                  aria-label="Password"
                  className="h-12 rounded-2xl border-white/80 bg-white/88 px-4 shadow-[0_10px_30px_rgba(113,80,54,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
                  placeholder="Password"
                  type="password"
                />

                <Button
                  type="button"
                  className="h-12 w-full rounded-2xl bg-[#7A4A2F] text-sm font-semibold text-white hover:bg-[#6B3F28]"
                >
                  {isLogin ? 'Log In to Ascala' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-white/80 bg-white/82 text-sm font-semibold text-foreground shadow-[0_10px_30px_rgba(113,80,54,0.06)] hover:bg-white"
                >
                  <GoogleMark />
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-white/80 bg-white/82 text-sm font-semibold text-foreground shadow-[0_10px_30px_rgba(113,80,54,0.06)] hover:bg-white"
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                  Prototype
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleSkipLogin}
                className="mt-6 h-12 w-full rounded-2xl border-[#C26A43]/35 bg-[#F9EEE6] text-sm font-semibold text-[#8E4524] hover:bg-[#F4E1D5]"
              >
                Skip login for now
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.805 12.23c0-.68-.061-1.334-.174-1.962H12v3.712h5.498a4.7 4.7 0 0 1-2.04 3.083v2.562h3.294c1.928-1.775 3.053-4.392 3.053-7.395Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.074-.914 6.765-2.475l-3.294-2.562c-.914.613-2.08.976-3.471.976-2.668 0-4.926-1.8-5.733-4.222H2.862v2.644A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.267 13.717A5.99 5.99 0 0 1 5.946 12c0-.596.103-1.174.321-1.717V7.639H2.862A10 10 0 0 0 2 12c0 1.611.385 3.137.862 4.361l3.405-2.644Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.061c1.5 0 2.846.516 3.906 1.53l2.929-2.929C17.07 3.02 14.756 2 12 2a10 10 0 0 0-9.138 5.639l3.405 2.644C7.074 7.861 9.332 6.061 12 6.061Z"
        fill="#EA4335"
      />
    </svg>
  );
}
