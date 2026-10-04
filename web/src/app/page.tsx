import HeroNavbar from '@/app/components/HeroNavbar'

export default function Home() {
  return (
    <div className="flex flex-col h-[700vh] flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl flex-col items-center pb-32 px-6 bg-white dark:bg-black sm:items-start sm:px-16">
        <HeroNavbar />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          </div>
      </main>
    </div>
  );
}
