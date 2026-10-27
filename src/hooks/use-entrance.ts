"use client";

import { useState } from "react";

/**
 * An entrance animation that plays once. Screens and tabs are hidden with
 * display:none while others are open, and CSS restarts animations when they
 * show again; dropping the class after the first run prevents that replay.
 */
export function useEntrance() {
  const [done, setDone] = useState(false);

  return {
    entering: !done,
    onAnimationEnd: (event: React.AnimationEvent) => {
      if (event.target === event.currentTarget) setDone(true);
    },
  };
}
