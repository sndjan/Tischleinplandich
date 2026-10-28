"use client";

import dynamic from "next/dynamic";

// The demo runs the planner's own components, so its code loads after the page
// instead of with it. The placeholder has the frame's size, so nothing jumps.
export const LazyLandingDemo = dynamic(() => import("./landing-demo").then((module) => module.LandingDemo), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      aria-label="Demo lädt"
      className="h-[680px] rounded-[28px] bg-brand-app-bg ring-1 ring-brand-card-border lg:h-[760px]"
    />
  ),
});
