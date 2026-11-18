import type { ReactNode } from "react";
import { Chat } from "../chat/Chat.js";
import type { Route } from "../routes.js";
import { SiteHeader } from "./SiteHeader.js";
import "./Shell.css";

export const MAIN_ID = "main";

// The frame every page shares. It stays mounted across client-side navigation,
// so anything rendered here outside <main> (the Chat above all) keeps its state
// when the page changes.
export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href={`#${MAIN_ID}`}>
        Skip to content
      </a>
      <SiteHeader route={route} />
      {/* tabIndex -1 lets the skip link and in-place navigation move focus here. */}
      <main id={MAIN_ID} tabIndex={-1} className="shell-main">
        {children}
      </main>
      <Chat />
    </div>
  );
}
