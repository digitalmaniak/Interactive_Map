// Shared flag: true while a flyover is playing or paused. The journal's Esc handler reads
// it and bails, so Esc during a flyover only ever stops the flyover.
export const flyoverActive = { current: false };
