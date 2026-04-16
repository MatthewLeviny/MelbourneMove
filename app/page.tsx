"use client";

import dynamic from "next/dynamic";

const TrainMap = dynamic(() => import("./components/TrainMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-screen h-screen bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">Loading map...</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return <TrainMap />;
}
