import { createContext } from 'react';

/**
 * True inside AuthShell's desktop card. That card grows with its content and
 * never scrolls on its own, so a FormScrollView inside it lays out as a plain
 * view; the panel around the card scrolls instead, and only when the window
 * is genuinely too short for the form.
 */
export const AuthCardContext = createContext(false);
