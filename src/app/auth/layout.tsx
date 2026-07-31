export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-gold/30 bg-white/70 p-8 shadow-sm backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
