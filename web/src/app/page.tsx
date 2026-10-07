import LiveDashboard from "@/app/components/LiveDashboard";
import { getDashboardSnapshot, type DashboardSnapshot } from "@/lib/nexus";

export default async function Home() {
  let initialSnapshot: DashboardSnapshot = { cards: [], snapshotAt: Date.now() };
  let initialFailed = false;
  try {
    initialSnapshot = await getDashboardSnapshot();
  } catch {
    initialFailed = true;
  }

  return (
    <div className="flex min-h-[120svh] flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      {process.env.NODE_ENV === "development" && (
        <span className="fixed bottom-4 left-4 z-50 rounded border border-nexus-yellow bg-white px-2 py-1 text-xs font-bold tracking-wider text-zinc-950 dark:bg-black dark:text-zinc-50">
          INDEV
        </span>
      )}
      <main className="flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-16 dark:bg-black sm:px-16">
        <LiveDashboard initialSnapshot={initialSnapshot} initialFailed={initialFailed} />
      </main>
    </div>
  );
}
