import { installBlockCaret } from "./block-caret"
import { installHaptics } from "./haptics"
import { installInputModality } from "./input-modality"
import { installSafariTabbing } from "./safari-tabbing"
import { installSound } from "./sound"

// The page-wide behaviors the skin relies on: the block caret, haptics and
// sounds, keyboard-only focus rings and Safari's Tab order. Each listens at
// the document, so they're installed once, however many roots there are.
let installed = false

function installHardware() {
  if (installed || typeof document === "undefined") return
  installed = true
  installBlockCaret()
  installHaptics()
  installSound()
  installSafariTabbing()
  installInputModality()
}

export { installHardware }
