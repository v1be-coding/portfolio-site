# Chatbot widget design for the portfolio site

Research notes for the spec, gathered 2026-11-17. The widget's shape is fixed: a launcher tab pinned to the lower-right corner of the viewport (`position: fixed`). Clicking it opens a chat panel. The bot answers questions about the site owner using only the site's content (bio, Projects). The conversation is **multi-turn**: the whole conversation stays in browser memory, each send posts every message so far, there's a cap of 20 messages, and there's no streaming. It's built with React. Playwright acceptance tests will find elements by ARIA role and accessible name.

Conventions in this file:

- Each claim links to its source. Text in quotation marks is quoted from that source.
- **Inference:** marks my own reasoning, which no source states.
- **Suggestion:** marks a name or rule I'm proposing for the spec.
- **Vendor practice:** marks what a chat-widget vendor documents. That's evidence of convention, not a standard.

## TL;DR

- **Pattern.** The APG has no non-modal dialog pattern. The two candidates are the disclosure pattern and the modal dialog pattern. A chat panel that a launcher opens fits best as a **non-modal `role="dialog"`** that keeps the disclosure-style `aria-expanded`/`aria-controls` on the launcher, moves focus into the panel when it opens, closes on Escape, and returns focus to the launcher when it closes. That combination is an inference, built from the [disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) and [modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) patterns, and it's what WCAG 2.4.11's Understanding doc assumes for a chat window ([source](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
- **Messages.** Put the conversation in a `role="log"`. Its implicit `aria-live` is `polite`, and the spec gives "chat logs" as an example ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)). New messages are appended at the end, so the default `aria-relevant` (`additions text`) is right ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-relevant)).
- **"Thinking…" state.** Use one small `role="status"` region (implicitly polite and atomic, per [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)), or a single pending item in the log. Never use `assertive`. This satisfies 4.1.3 Status Messages ([Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
- **Mobile.** On narrow screens, make the panel near full-screen and size it with `dvh`. Pad it with `env(safe-area-inset-*)`. The keyboard shrinks only the visual viewport by default, so either set `interactive-widget=resizes-content` or track `visualViewport` ([MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport), [MDN Visual Viewport](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)).
- **Content.** Give a specific opening message that states the bot's scope ("I answer questions about Emiliano's bio and Projects"). Show 2 to 4 suggested questions as buttons and keep answers short. Don't autoscroll to the bottom of a long answer. Give a clear fallback to the contact email ([NN/g guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/), [NN/g site chatbot](https://www.nngroup.com/articles/site-ai-chatbot/), [NN/g less chat](https://www.nngroup.com/articles/less-chat-more-answer/)).

## 1. Recommended ARIA pattern, keyboard and focus

### What the sources say

**Disclosure pattern** ([APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/))

- "A disclosure is a widget that enables content to be either collapsed (hidden) or expanded (visible)."
- "The element that shows and hides the content has role button."
- "When the content is visible, the element with role `button` has aria-expanded set to `true`." `aria-controls` is optional and points at "the element that contains all the content that is shown or hidden."
- Enter and Space toggle it. The pattern **doesn't say** whether focus moves into the revealed content, and it has no Escape key.

**Modal dialog pattern** ([APG dialog modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/))

- "When a dialog opens, focus moves to an element contained in the dialog." "Generally, focus is initially set on the first focusable element." For content with semantic structure or a lot of content, the pattern suggests focusing a static element with `tabindex="-1"` at the top instead.
- "When a dialog closes, focus returns to the element that invoked the dialog," unless that element no longer exists or the workflow needs a different target.
- Escape: "Closes the dialog." Tab and Shift+Tab cycle inside the dialog.
- The container has role `dialog` and "aria-modal set to `true`", and it's labelled by `aria-labelledby` (pointing at a visible title) or `aria-label`.
- "It is strongly recommended that the tab sequence of all dialogs include a visible element with role `button`" that closes the dialog.
- On the non-modal kind, the pattern only says this: "unlike most non-modal dialogs, modal dialogs do not provide means for moving keyboard focus outside the dialog window." **The APG publishes no separate non-modal dialog pattern.**

**WAI-ARIA 1.2** ([spec](https://www.w3.org/TR/wai-aria-1.2/))

- `dialog`: "A dialog is a descendant window of the primary window of a web application."
- `aria-modal`: the default is `false` ("Element is not modal"). When it's `true`, the element blocks the rest of the page while it's displayed.
- `aria-expanded`: "Indicates whether a grouping element owned or controlled by this element is expanded or collapsed." If the controlling element doesn't own the container, authors should link the two with `aria-controls`.
- `aria-controls`: "Identifies the element (or elements) whose contents or presence are controlled by the current element."
- `aria-haspopup`: one of its values is `dialog` ("Indicates the popup is a dialog"), and the popup's role must match the value.

**WCAG 2.2** ([Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html))

- The Understanding doc names persistent user-opened content, "such as a chat window," as content that can fail 2.4.11. It passes if users can reveal the focused item without navigating back to dismiss the overlay, "for example by pressing Escape."
- A dialog-like overlay that doesn't take focus when it opens, and doesn't trap focus or close when focus leaves, is "at risk of failing this SC" if it can cover focusable items.
- 2.1.2 No Keyboard Trap allows focus to be restricted to part of a page "as long as the user knows how to 'untrap' the focus and leave that component," and the example closes with Esc ([Understanding 2.1.2](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html)).

### Which pattern fits

**Inference:** a plain disclosure pattern isn't enough on its own. The panel is a persistent overlay that can cover page content, so 2.4.11 points toward moving focus into it and closing it on Escape, and the disclosure pattern defines neither. A modal dialog would trap focus and make the rest of the page inert, which is heavier than a portfolio side panel needs on desktop. The best fit is a **non-modal dialog** that borrows focus handling from the modal pattern and the `aria-expanded` state from the disclosure pattern.

### Concrete rules (Suggestions)

1. The launcher is a `<button>` with an accessible name, `aria-expanded="false|true"`, and `aria-controls` pointing at the panel's id. Use `aria-haspopup="dialog"` optionally ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)). **Inference:** with `aria-haspopup`, some screen readers announce "dialog" on the button. That's harmless, but tests shouldn't depend on it.
2. The panel is `role="dialog"`, with `aria-modal` left unset (false) on desktop, and `aria-labelledby` pointing at a visible heading such as "Ask about Emiliano".
3. On open, focus moves to the message input. **Inference:** the APG's "first focusable element" rule would put focus on the close button if that comes first in DOM order. Typing a question is the main task, which is the APG's "most frequently used" case, so the input is the better target. The spec should say so explicitly.
4. Escape closes the panel from anywhere inside it, including the input ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
5. The panel has a visible close button inside it ([APG note 3](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)). Clicking the launcher again also closes the panel, so the launcher should stay visible or the close button should replace it. **Inference.**
6. On close, by any means, focus returns to the launcher, and its `aria-expanded` changes to `false` ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)).
7. Non-modal on desktop: Tab may leave the panel, and the page stays usable. Every control in the panel is reachable by keyboard ([WCAG 2.1.1](https://www.w3.org/TR/WCAG22/)), and nothing traps focus ([2.1.2](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html)).
8. Closing hides the panel but keeps the conversation in React state. Reopening shows the same log. **Inference** from "kept in browser memory". Unmounting the component would lose it unless the state lives above it.
9. Enter in the input sends the message. If the input is a multi-line `<textarea>`, Shift+Enter adds a new line. **Suggestion.** Sending moves focus nowhere: focus stays in the input. **Inference:** this follows 3.2.2 On Input in spirit, and it lets the user ask a follow-up right away.
10. While a request is pending, either disable the send button or ignore a resend. **Suggestion.** Each send posts the whole conversation, so overlapping sends would race.

## 2. Live regions and the "thinking…" state

### What the sources say

- `log`: "A type of live region where new information is added in meaningful order and old information may disappear." "Examples include chat logs, messaging history, game log, or an error log." "New information is added only to the end of the log." "Elements with the role log have an implicit aria-live value of polite." ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/))
- MDN adds that `log` has an implicit `aria-atomic` of `false` and "is required to have an accessible name" ([MDN log role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role)).
- `aria-live` values ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)):
  - `off` (the default): updates aren't presented "unless the user is currently focused on that region."
  - `polite`: updates are presented "at the next graceful opportunity," "such as at the end of speaking the current sentence or when the user pauses typing."
  - `assertive`: updates have "the highest priority and should be presented the user immediately."
- `aria-relevant` defaults to `additions text`, "because generally text modifications and node additions are relevant, but node removals are not". The `removals` and `all` values "should be used sparingly" ([MDN aria-relevant](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-relevant)). I couldn't retrieve the spec's own `aria-relevant` section through the fetch tool, so this rests on MDN.
- `aria-busy`: when it's `true`, assistive technologies may ignore changes, then process them as one update once it's `false`. Authors may set it during multiple changes "announced as a single unit" ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)).
- `status`: "advisory information for the user but is not important enough to justify an alert". "Elements with the role status have an implicit aria-live value of polite and an implicit aria-atomic value of true." ([WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/))
- SC 4.1.3 says status messages must be "programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus." A status message includes information "on the waiting state of an application". Sufficient techniques include ARIA22 (`role=status`) and ARIA23 (`role=log`). The Understanding doc has a "busy" example that a screen reader announces as "application busy." It doesn't mention chat. ([Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html))

### Rules (Suggestions, with inferences labelled)

1. The message list is `role="log"` with an accessible name, for example `aria-label="Conversation"`. Each message is a child element appended at the end, and none are ever reordered.
2. Don't set `aria-relevant`. The default is right because messages are only added. **Inference:** at the 20-message cap, if the spec makes the oldest messages disappear, the default still won't announce the removals, which is what we want. If the spec instead blocks further sends at the cap, announce that through the status region.
3. Don't wrap the log in `aria-live="assertive"`. **Inference:** the user's own message is also appended to the log, so it may be read back politely. That's normal chat behaviour. Suppressing it would mean rendering user messages outside the log, which breaks reading order.
4. For "thinking…", **pick one** of these:
   - (a) A single visually small `role="status"` element in the panel. Set its text to "Thinking…" when the request starts and clear it when the answer lands. The answer is then announced through the log.
   - (b) A temporary "Thinking…" item at the end of the log that's _replaced_ by the answer.

   **Inference:** (a) is less noisy. With (b), "Thinking…" is announced and then the answer is announced as a new addition, but the removal isn't, so (b) works too. Don't do both, or users hear it twice. Don't animate the text (for example, cycling dots that change the text node), because each text change in a live region can be re-announced under `aria-relevant` `text`.

5. Optionally, set `aria-busy="true"` on the log while it's being updated. **Inference:** with no streaming, each answer is one DOM insertion, so `aria-busy` adds little. Leave it out unless a single answer is inserted in several steps.
6. Errors (network or server) go into the log as a bot-styled message, or into the status region, with text that offers the contact email (see section 5). **Suggestion.**
7. Message structure: each message should expose who said it through text, not just colour or alignment ([1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) requires that relationships conveyed through presentation "can be programmatically determined" or be available in text). **Suggestion:** use a visually hidden "You:" or "Assistant:" prefix, or a list (`<ol>`/`<li>`) inside the log with each item labelled.

## 3. Accessible names and roles a test could rely on (Suggestions)

These are proposals for the spec, not things any source requires. Playwright's `getByRole(role, { name })` matches the computed accessible name.

| Element            | Role               | Accessible name (suggested)                                           | State a test can assert                  |
| ------------------ | ------------------ | --------------------------------------------------------------------- | ---------------------------------------- |
| Launcher tab       | `button`           | "Ask about Emiliano" or "Open chat"                                   | `aria-expanded` is `false`/`true`        |
| Panel              | `dialog`           | "Ask about Emiliano" (from the visible heading via `aria-labelledby`) | visible / hidden                         |
| Panel heading      | `heading`          | the same text as the dialog name                                      |                                          |
| Conversation       | `log`              | "Conversation"                                                        | child count, and the last message's text |
| Message input      | `textbox`          | "Your question" (a visible `<label>` is better than a placeholder)    | focused after open                       |
| Send               | `button`           | "Send"                                                                | disabled while pending (if specced)      |
| Close              | `button`           | "Close chat"                                                          |                                          |
| Suggested question | `button`           | the question's text, for example "What has Emiliano built?"           | clicking sends it                        |
| Thinking indicator | `status`           | (status needs no name. A test checks its text "Thinking…")            | text present while pending               |
| AI label           | text in the dialog | for example "AI assistant. Answers come from this site's content."    | visible                                  |
| Contact fallback   | `link`             | the email address, or "Email Emiliano" (a `mailto:` link)             | `href` starts with `mailto:`             |

Notes:

- **Inference:** if the launcher's name changes between "Open chat" and "Close chat", tests have to look it up by two names. A stable name plus `aria-expanded` is simpler, and it's also what the disclosure pattern expects. Keep the launcher's name and the close button's name distinct, so `getByRole('button', { name: 'Close chat' })` matches exactly one element.
- **Inference:** use exact-match names in tests, or `{ exact: true }`, because Playwright's default name matching is a case-insensitive substring match. That means "Send" would also match a "Send feedback" button.
- **Inference:** the message cap is 20 _messages_, which presumably counts both user and assistant messages (10 exchanges). The spec must say whether the cap counts both sides, whether the opening greeting counts, and what the UI shows at the cap (input disabled plus a status message is the testable choice).

## 4. Mobile behaviour

### What the sources say

- `position: fixed`: "The element is positioned relative to its initial containing block, which is the viewport in the case of visual media." It "always creates a new stacking context." An ancestor with `transform`, `perspective` or `filter` (or `will-change: transform`) becomes the containing block instead. ([MDN position](https://developer.mozilla.org/en-US/docs/Web/CSS/position))
- `env(safe-area-inset-*)`: "The safe distance from the top, right, bottom, or left inset edge of the viewport, defining where it is safe to place content into without risking it being cut off by the shape of a non‑rectangular display." It accepts a fallback as its second argument ([MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)).
- `viewport-fit=cover`: "The viewport is scaled to fill the device display. It's highly recommended to use the safe area inset variables to ensure that important content doesn't end up outside the display." ([MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport))
- `interactive-widget` ([MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)):
  - `resizes-visual`: "The visual viewport gets resized by the interactive widget. This is the default."
  - `resizes-content`: "The viewport gets resized by the interactive widget."
  - `overlays-content`: "Neither the viewport nor the visual viewport gets resized."
- Visual viewport: "User-interface features like the on-screen keyboard (OSK) can shrink the visual viewport without affecting the layout viewport." The API exposes `resize` and `scroll` events. MDN's `device-fixed` emulation example warns it "can result in the fixed element flickering during scrolling." ([MDN Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API))
- Viewport units ([MDN length](https://developer.mozilla.org/en-US/docs/Web/CSS/length)):
  - Dynamic units (`dvh`) are "automatically sized in response to browser interfaces dynamically expanding or retracting."
  - `vh` "is equivalent to `lvh`", the large viewport, so content "might get hidden when browser interfaces expand."
  - `dv*` units can make content "resize while a user is scrolling a page".
  - The page talks about browser UI (address bars), **not the virtual keyboard**.
- VirtualKeyboard API: `navigator.virtualKeyboard.overlaysContent = true` stops the automatic resize. It exposes `env(keyboard-inset-height)` and friends, plus a `geometrychange` event. It's "Experimental" and "not Baseline because it does not work in some of the most widely-used browsers," and it needs a secure context ([MDN VirtualKeyboard API](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API)).
- WCAG 1.4.10 Reflow requires no two-dimensional scrolling at "a width equivalent to 320 CSS pixels" ([Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)). It notes that "sticky or fixed content can make reading content difficult if not impossible" and suggests that such content can be made static or "toggled by the user."
- WCAG 2.5.8 requires a pointer target of "at least 24 by 24 CSS pixels" (AA), with a spacing exception ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- WCAG 1.4.11 requires 3:1 contrast for "visual information required to identify user interface components and states", and for icons such as a close "X" ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).

### Rules (Suggestions)

1. **Launcher placement:** `position: fixed; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px));`, with `viewport-fit=cover` in the viewport meta if the site wants edge-to-edge layout. **Inference:** without `viewport-fit=cover`, the insets are typically 0 and the browser keeps content inside the safe area anyway, so the fallback is harmless.
2. **Launcher size:** at least 24×24 CSS px to pass 2.5.8. **Inference:** aim for about 44 to 56 px for a primary floating control, since 24 px is the floor. The launcher's icon or edge and its focus ring need 3:1 contrast against the page behind it, which changes as the page scrolls, so give the launcher a solid background.
3. **Don't put `position: fixed` inside a transformed ancestor.** Render the widget at the document root, through a React portal to `document.body`. This follows from the [MDN containing-block rule](https://developer.mozilla.org/en-US/docs/Web/CSS/position). **Inference** about React.
4. **Panel on desktop:** anchored above the launcher, for example 360 to 400 px wide, with `max-height: min(600px, calc(100dvh - <offsets>))`. **Suggestion.**
5. **Panel at narrow widths** (≤ about 480 px, and always at 320 px for 1.4.10): full-width, with height `100dvh` or inset 0, and padding for the safe areas. Message text wraps, with no horizontal scrolling (`overflow-wrap: anywhere` for long URLs). **Inference:** a full-screen panel on a phone covers the whole page, which is effectively modal. Setting `aria-modal="true"` at that breakpoint and making the background inert is defensible. See Open questions.
6. **Virtual keyboard:** the default, `resizes-visual`, shrinks only the visual viewport, so a `bottom: 0` fixed input can end up behind the keyboard. Options, in order of simplicity:
   - (a) Add `interactive-widget=resizes-content` to the viewport meta, so the layout viewport (and `dvh`/fixed positioning) shrinks with the keyboard.
   - (b) Listen to `visualViewport` `resize` and set the panel height from `visualViewport.height`.
   - (c) The VirtualKeyboard API plus `env(keyboard-inset-height)`, as progressive enhancement only, because it isn't Baseline.

   **Inference:** browser support for `interactive-widget` is uneven (MDN's page didn't show the compatibility table in my fetch), so the spec shouldn't make the acceptance tests depend on keyboard geometry. Playwright's mobile emulation doesn't simulate an on-screen keyboard anyway.

7. **Focus Not Obscured (2.4.11):** the closed launcher is small and fixed in the corner, and it can cover a focused link near the bottom-right of the page. Add `scroll-padding-bottom` to the root (technique C43, listed in [Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)), or a footer margin, so focused elements aren't entirely hidden. 2.4.12 (AAA) requires that "no part of the component is hidden" ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)). When the panel is open on desktop and non-modal, Escape closing it is what lets it pass 2.4.11 (see section 1).
8. **Scrolling in the log:** the log is its own scroll container (`overflow-y: auto`). Use `overscroll-behavior: contain` so the page doesn't scroll behind it. **Inference.** See section 5 for where to scroll when a reply arrives.

## 5. Content and UX guidance (NN/g, 2026)

Sources:

- "What Is Your Site's AI Chatbot for? Users Can't Tell", by Rosala, Kenderova and Kohler, 20 March 2026 ([link](https://www.nngroup.com/articles/site-ai-chatbot/)).
- "Less Chat, More Answer", by the same authors, 17 April 2026 ([link](https://www.nngroup.com/articles/less-chat-more-answer/)).
- "10 Guidelines for Designing Your Site's AI Chatbots", by Kenderova, Rosala and Kohler, 24 April 2026 ([link](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)).

All three come from e-commerce and service sites, not personal portfolios. **Inference:** the principles carry over, but the stakes are lower, and visitors are likely recruiters or peers with specific questions.

### What the sources say

- **Purpose is unclear by default.** Participants "rarely used site AI chatbots" and couldn't tell what the bots offered beyond search. "Users will not experiment to discover a chatbot's value." ([site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/))
- **Opening message.** The authors advise against generic openers like "How can I help you?" and a vague promise ("help you find any info you need") misled users ([site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/)). "The chatbot should clearly and concisely indicate what it can do". "Indicate the topics or tasks the chatbot can help with in the introductory message". The opening message "should not overwhelm the user with detailed explanations." ([guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/))
- **Suggested prompts.** "Providing suggested prompts reduces user effort by removing the burden of formulating questions". "Present them as clickable buttons, rather than text". Update them to suit the page ([guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)). After an answer, give "only the essential answer first, then offer relevant followup prompts" ([less-chat](https://www.nngroup.com/articles/less-chat-more-answer/)).
- **Answer style.** "A longer answer was not a better answer." Keep paragraphs to "no more than 2–3 sentences". Use lists when an answer must be long. Cut pleasantries like "great question!". "No one said 'hello' to the bots." "Clarification questions should be used sparingly." ([less-chat](https://www.nngroup.com/articles/less-chat-more-answer/))
- **Streaming.** "Streaming long responses can intensify the sense of overload" ([less-chat](https://www.nngroup.com/articles/less-chat-more-answer/)). This supports the no-streaming decision.
- **Autoscroll.** "Keep the user's scroll position at the top of the new message rather than jumping to the bottom" (guideline 7, [guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)).
- **Identity and naming.** One site's bot was "confusingly named both" Olive and AI Sous Chef ([site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/)). Guideline 1 praises "one chatbot that clearly identifies itself" ([guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)). **None of the three articles has a dedicated guideline on labelling a bot as AI.**
- **Escalation.** Guideline 1 describes a chatbot that "escalates questions to humans when it can't" ([guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)). Participants disliked dead ends like "I'm sorry, but we can't help you with that. Call this number." ([site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/))
- **Placement.** The bots sat in inconsistent places (search bar, navigation, corner icons). A corner icon is unobtrusive but easy to ignore: "I appreciate that they keep it out of the way when it's down there in the bottom." One user mistook an icon for "just a graphic." ([site-ai-chatbot](https://www.nngroup.com/articles/site-ai-chatbot/)) Make it available "on every page" (guideline 2, [guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)).
- **Other guidelines:** resizable or maximisable windows (8), save or share (9), images (5), progressive disclosure (6) and voice input (10) ([guidelines](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)). **Inference:** most of these are out of scope for this episode. Save or share fits poorly with memory-only state.

### Applied to this site (Suggestions)

1. **Launcher label:** text plus an icon, not an icon alone, because NN/g found corner icons easy to miss or mistake for graphics. For example, a tab reading "Ask about Emiliano". **Inference.**
2. **Opening message** (first item in the log, shown on open): one or two sentences that name the scope and the limit. For example: "Hi, I'm an AI assistant. I can answer questions about Emiliano's background and Projects, using only what's on this site." The spec must say whether this counts toward the 20-message cap and whether it's sent to the server.
3. **Labelled as AI:** the opening message, or a subtitle under the panel heading, says "AI". **Inference:** NN/g doesn't require this, but it's the plain reading of "clearly identifies itself", and it sets expectations for possible errors. Give it a stable piece of text a test can find.
4. **Suggested questions:** 2 to 4 buttons under the opening message, for example "What does Emiliano work on?", "Show me a Project with a Scorecard", "How can I contact Emiliano?". Clicking one sends it as a user message. **Inference:** hide them after the first send, or replace them with follow-up prompts. The spec must pick one so tests are deterministic.
5. **Out-of-scope or unknown answers:** the bot says it can only answer from the site's content, and gives the contact email as a `mailto:` link, not just a bare string. That's the "escalation to a human" path, and it avoids a dead end. **Inference:** on a portfolio, the human is the owner, and email is the handoff.
6. **Answer length:** the system prompt asks for short answers (2 or 3 sentences, lists where needed) with no pleasantries. **Inference:** this is a server and prompt concern. Tests can't check it reliably, so it belongs in the spec as guidance, not as an acceptance criterion.
7. **Scroll on new reply:** when an answer arrives, scroll the log so the **top** of the new assistant message is visible, not the bottom of the log. When the user sends a message, scrolling the user message into view is fine. If the user has scrolled up to read history, don't yank them down. **Inference** that extends NN/g guideline 7 to multi-turn.
8. **The cap:** when 20 messages are reached, show a clear notice in the status region and in visible text (for example, "This conversation has reached its limit. Start a new one, or email Emiliano.") with a "New conversation" button that clears memory. **Suggestion.** No source covers caps.

## 6. Vendor practice (labelled, not standards)

- **Vendor practice (Intercom):** "By default the Messenger will appear on the bottom right corner of your site." You can configure the position with `alignment` (left or right), `horizontal_padding` and `vertical_padding`. On mobile web, the Messenger "will always remain on a high z-index" because "the Messenger needs to be displayed on the top of everything." ([Intercom developer docs](https://developers.intercom.com/installing-intercom/web/customization)) A search summary says Intercom's help centre enforces a 20 px minimum padding on desktop and ignores padding on mobile web, but I didn't open that page, so treat it as unverified ([Intercom Messenger FAQs](https://www.intercom.com/help/en/articles/6612597-messenger-faqs)).
- I didn't check Zendesk or Drift.

## 7. Open questions and conflicts

1. **Modal or non-modal?** The APG has no non-modal dialog pattern. A non-modal panel needs Escape to pass 2.4.11 ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)), while a modal one "always passes" that SC. On phones, the full-screen panel is visually modal anyway. **Spec decision needed:** non-modal everywhere, modal everywhere, or modal only at narrow widths. Changing modality by breakpoint makes tests more complex (two viewport projects).
2. **Initial focus:** the APG default is the first focusable element. My suggestion is the input. The spec should pin it so the test is deterministic.
3. **Launcher visibility while open:** keep it visible as a toggle (with `aria-expanded="true"`), or hide it behind the panel? If it's hidden, the close button is the only way to close by pointer, and tests can't assert `aria-expanded="true"` on a hidden element.
4. **Thinking indicator:** a status region or a log item (section 2, rule 4). Pick one.
5. **Message cap semantics:** whether 20 messages include the greeting and the assistant messages, and what happens at the cap: block further sends, or drop the oldest. Dropping the oldest conflicts with "each send posts every message so far" unless the server only ever sees the last N. **Spec decision needed.**
6. **Suggested questions after the first send:** hide, keep, or replace with follow-ups.
7. **Conversation on close and reopen:** keep it (my suggestion) or reset. And whether a page reload loses it. It does, if it's memory-only, which is consistent with the brief.
8. **AI labelling:** NN/g doesn't require it explicitly. It's included here as an inference.
9. **Virtual keyboard handling:** `interactive-widget` and the VirtualKeyboard API have uneven support. I didn't verify compatibility tables, because MDN's compatibility data didn't render in my fetches. Don't base acceptance tests on keyboard geometry.
10. **Spec text gaps:** I couldn't retrieve the WAI-ARIA 1.2 `aria-relevant` section through the fetch tool. Its default (`additions text`) is cited from MDN. I didn't open the full WCAG 2.4.12 Understanding doc, so its normative text is quoted from the [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/).
11. **Conflict, NN/g vs. common chat practice:** many chat UIs autoscroll to the bottom on each new message. NN/g guideline 7 says to keep the view at the top of the new message. With answers limited to 2 or 3 sentences, the two usually look the same. The spec should still state the rule.
