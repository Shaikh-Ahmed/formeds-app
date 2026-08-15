// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web document shell.
 *
 * react-native-web can express layout but not the browser-only affordances a
 * desktop user reads as "this is a real website": a keyboard focus ring, a
 * pointer cursor, hover transitions, a styled scrollbar. Those are global CSS
 * concerns, so they live here once rather than being re-implemented per
 * component.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta
          name="description"
          content="ForMeds — India's first integrated healthcare platform. A verified network for healthcare professionals, hospitals and clinics."
        />
        <meta name="theme-color" content="#1A3A5C" />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }

              /* Type rendering: RN's default web output looks heavier than
                 native. Antialiasing brings desktop weight back in line. */
              body {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
              }

              /* One focus treatment for the whole app. Never remove this
                 without replacing it — keyboard users have no other way to
                 tell where they are. */
              :focus-visible {
                outline: 2px solid #1A3A5C;
                outline-offset: 2px;
                border-radius: 4px;
              }
              /* Mouse clicks shouldn't leave a ring behind; keyboard focus still does. */
              :focus:not(:focus-visible) { outline: none; }

              /* Pointer feedback on anything interactive. */
              [role="button"], [role="link"], [role="tab"], button, a {
                cursor: pointer;
              }
              [aria-disabled="true"] { cursor: not-allowed; }

              /* Hover/press colour changes ease instead of snapping. 150ms is
                 below the threshold where a pointer user perceives lag. */
              [role="button"], [role="link"], [role="tab"] {
                transition: background-color 150ms ease, opacity 150ms ease;
              }

              input, textarea { caret-color: #1A3A5C; }
              ::selection { background: #1A3A5C; color: #FFFFFF; }

              /* Scrollbars: the default Windows bar is wide and grey enough to
                 read as chrome bolted onto the page. */
              * { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
              ::-webkit-scrollbar { width: 10px; height: 10px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb {
                background-color: #CBD5E1;
                border-radius: 999px;
                border: 3px solid transparent;
                background-clip: content-box;
              }
              ::-webkit-scrollbar-thumb:hover { background-color: #94A3B8; background-clip: content-box; }

              /* Honour the OS setting. Motion here is decorative, so it is
                 safe to drop entirely rather than merely shorten. */
              @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                  animation-duration: 0.01ms !important;
                  animation-iteration-count: 1 !important;
                  transition-duration: 0.01ms !important;
                  scroll-behavior: auto !important;
                }
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
