// The design system. One token set and one rule per surface recipe; each recipe's selector list is our `ui-*` hook
// followed by every tldraw element that is that surface, so a look is defined in exactly one place.
// Components use the hooks (`ui-panel`, `ui-well`, `ui-key`, `ui-kbd`, `ui-label`, `ui-option`, `ui-icon-button`,
// `ui-rule-top`, `ui-rule-bottom`; `ui-round` makes a surface and the keys inside it pill-shaped) and never restate colors, faces, or shadows.
// Depth is soft: a one-pixel highlight along the top of raised faces, a one-pixel shade along the bottom, no rims.

const tokens = `
:where(.tl-container) {
 --ui-font:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Helvetica,Arial,sans-serif;
 --ui-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
 --ui-radius:10px; --ui-radius-key:7px; --ui-radius-kbd:4px;
 --ui-ink:#262626; --ui-ink-2:#737373; --ui-ring:#a3a3a3;
 --ui-bg:#ffffff; --ui-panel-solid:#fafafa; --ui-line:#0000000f;
 --ui-panel:linear-gradient(180deg,#fdfdfd,#f4f4f4);
 --ui-key:linear-gradient(180deg,#ffffff,#ededed);
 --ui-key-hover:linear-gradient(180deg,#ffffff,#f5f5f5);
 --ui-selected:linear-gradient(180deg,#f0f0f0,#e1e1e1);
 --ui-well:linear-gradient(180deg,#ededed,#f7f7f7);
 --ui-highlight:#ffffff; --ui-shade:#0000000d; --ui-shade-2:#0000001a; --ui-drop:#00000012;
 --ui-shadow-panel:inset 0 1px 0 var(--ui-highlight),0 1px 2px var(--ui-shade-2),0 12px 24px var(--ui-drop);
 --ui-shadow-attached:inset 0 1px 0 var(--ui-highlight),0 2px 6px var(--ui-drop);
 --ui-shadow-key:inset 0 1px 0 var(--ui-highlight),inset 0 -1px 0 var(--ui-shade),0 1px 2px var(--ui-shade-2);
 --ui-shadow-selected:inset 0 1px 0 var(--ui-highlight),inset 0 -1px 0 var(--ui-shade),0 1px 3px var(--ui-shade-2);
 --ui-shadow-well:inset 0 2px 4px var(--ui-shade-2),0 1px 0 var(--ui-highlight);
}
.tl-theme__dark {
 --ui-ink:#fafafa; --ui-ink-2:#a3a3a3; --ui-ring:#8a8a8a;
 --ui-bg:#0f0f0f; --ui-panel-solid:#1c1c1c; --ui-line:#ffffff12;
 --ui-panel:linear-gradient(180deg,#222222,#1a1a1a);
 --ui-key:linear-gradient(180deg,#343434,#282828);
 --ui-key-hover:linear-gradient(180deg,#3d3d3d,#2f2f2f);
 --ui-selected:linear-gradient(180deg,#4a4a4a,#3a3a3a);
 --ui-well:linear-gradient(180deg,#0f0f0f,#171717);
 --ui-highlight:#ffffff14; --ui-shade:#00000059; --ui-shade-2:#00000080; --ui-drop:#00000059;
}
.tl-container {
 --tl-color-panel:var(--ui-panel-solid); --tl-color-low:var(--ui-panel-solid); --tl-color-low-border:transparent;
 --tl-color-divider:var(--ui-line); --tl-color-hint:var(--ui-line); --tl-color-muted-2:var(--ui-line);
 --tl-color-text:var(--ui-ink); --tl-color-text-1:var(--ui-ink); --tl-color-text-3:var(--ui-ink-2);
 --tl-color-tooltip:var(--ui-panel-solid); --tl-color-text-shadow:var(--ui-ink); --tl-color-focus:var(--ui-ring);
 --tl-shadow-1:var(--ui-shadow-attached); --tl-shadow-2:var(--ui-shadow-panel); --tl-shadow-3:var(--ui-shadow-panel); --tl-shadow-4:var(--ui-shadow-panel);
 --tl-radius-2:6px; --tl-radius-3:var(--ui-radius); --tl-radius-4:var(--ui-radius);
}
.tl-theme__dark { --tl-color-background:var(--ui-bg); }
@media (prefers-contrast:more) { :where(.tl-container) { --ui-line:var(--ui-ink-2); --ui-shade:var(--ui-ink-2); --ui-highlight:var(--ui-ink-2); } }
`

// Surface recipes: [our hook, ...tldraw elements that are this surface].
const panel = ['.ui-panel', '.tlui-main-toolbar__tools', '.tlui-style-panel__wrapper', '.tlui-menu', '.tlui-popover__content', '.tlui-hover-card__content', '.tlui-dialog__content', '.tlui-toast__container', '.tlui-cmt-thread', '.tlui-tooltip']
const attached = ['.ui-panel--attached', '.tlui-main-toolbar__extras__controls', '.tlui-menu-zone', '.tlui-navigation-panel::before', '.tlui-help-menu .tlui-button__low']
const key = ['.ui-key', '.ui-kbd', '.tlui-kbd > span', '.tlui-slider__thumb', '.tlui-button__low', '.tlui-button__menu[data-highlighted]::after', '.tlui-dialog__footer__actions .tlui-button::after']
const keyHover = ['.ui-key:where(:hover:not(:disabled,[aria-pressed=true]))', '.tlui-button:not(:disabled,[data-disabled]):hover::after']
const selected = ['.ui-key[aria-pressed=true]', '.ui-option[aria-selected=true]', '.tlui-button[data-isactive=true]::after', '.tlui-button[data-isactive=true]:not(:disabled,[data-disabled],:focus-visible):active::after', '.tlui-button__tool[aria-pressed=true]:not(:disabled,[data-disabled])::after', '.tlui-page-menu__item[data-iscurrent=true]:not([data-editing=true])::before', '.tlui-slider__range']
const well = ['.ui-well', '.ui-key:where(:active:not(:disabled))', '.tlui-button:not(:disabled,[data-disabled]):active::after', '.tlui-button[data-state=open]::after', '.tlui-zoom-menu__button[data-state=open]::after', '.tlui-page-menu__trigger[data-state=open]::after', '.tlui-menu-zone [data-state=open]::after', '.tlui-input__wrapper .tlui-input', '.tlui-page-menu__item__input', '.tlui-slider__track::after', '.tlui-slider__thumb:active']
const ruleTop = ['.ui-rule-top', '.tlui-dialog__footer']
const ruleBottom = ['.ui-rule-bottom', '.tlui-dialog__header', '.tlui-menu__group:not(:last-of-type)', '.tlui-style-panel__section:not(:nth-last-child(-n+1 of .tlui-style-panel__section:not(:empty)))']

const recipes = `
${panel} { background:var(--ui-panel); box-shadow:var(--ui-shadow-panel); border-radius:var(--ui-radius); color:var(--ui-ink); }
${attached} { background:var(--ui-panel); box-shadow:var(--ui-shadow-attached); border-color:transparent; }
${key} { background:var(--ui-key); box-shadow:var(--ui-shadow-key); color:var(--ui-ink); border-radius:var(--ui-radius-key); opacity:1; }
@media (hover:hover) { ${keyHover} { background:var(--ui-key-hover); box-shadow:var(--ui-shadow-key); opacity:1; } }
${selected} { background:var(--ui-selected); box-shadow:var(--ui-shadow-selected); opacity:1; }
${well} { background:var(--ui-well); box-shadow:var(--ui-shadow-well); opacity:1; }
${ruleTop} { box-shadow:inset 0 1px 0 var(--ui-line),inset 0 2px 0 var(--ui-highlight); }
${ruleBottom} { box-shadow:inset 0 -1px 0 var(--ui-line); border-bottom:0; }

/* Hooks with their own geometry. */
.ui-round,.ui-round .ui-key { border-radius:999px; }
.ui-key { border:0; cursor:pointer; transition:transform 120ms ease,background 90ms ease,box-shadow 90ms ease; }
.ui-key:where(:active:not(:disabled)) { transform:translateY(1px); }
.ui-key:disabled { opacity:.35; cursor:default; }
.ui-icon-button { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; flex-shrink:0; padding:0; border:0; background:transparent; color:var(--ui-ink-2); cursor:pointer; transition:color 120ms ease,transform 120ms ease; }
.ui-icon-button:where(:hover:not(:disabled)),.ui-icon-button[aria-pressed=true] { color:var(--ui-ink); }
.ui-icon-button:disabled { opacity:.35; cursor:default; }
.ui-icon-button svg { width:16px; height:16px; }
.ui-kbd,.tlui-kbd > span { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; border-radius:var(--ui-radius-kbd); font:10px/1 var(--ui-mono); font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.tlui-kbd { display:inline-flex; gap:3px; font-family:var(--ui-mono); }
.tlui-kbd > span:last-child { padding-inline-end:5px; }
.ui-label { color:var(--ui-ink-2); font:10px/1 var(--ui-mono); letter-spacing:.1em; text-transform:uppercase; }
.ui-option { display:flex; align-items:center; gap:10px; height:36px; padding:0 10px; border-radius:var(--ui-radius-key); color:var(--ui-ink); cursor:pointer; }
.ui-option[aria-selected=true] { color:var(--ui-ink); }
:is(.ui-key,.ui-icon-button,.ui-option):focus-visible { outline:2px solid var(--ui-ring); outline-offset:-2px; }
.ui-well:has(input,textarea) :is(input,textarea):focus-visible { outline:none; box-shadow:none; }
@media (prefers-reduced-motion:reduce) { .ui-key,.ui-icon-button { transition:none; } .ui-key:where(:active:not(:disabled)) { transform:none; } }
`

// tldraw geometry that its stylesheet fixes and the recipes need loosened.
const tldraw = `
.tlui-layout,.tlui-menu,.tlui-popover__content,.tlui-dialog__content,.tlui-tooltip,.tlui-toast__container,.tlui-hover-card__content { font-family:var(--ui-font); font-weight:450; letter-spacing:.005em; }
.tlui-main-toolbar__extras__controls { border-radius:var(--ui-radius) var(--ui-radius) 0 0; }
.tlui-help-menu { border-color:transparent; }
.tlui-button::after { border-radius:var(--tl-radius-2); transition:opacity 90ms ease,background 90ms ease,box-shadow 90ms ease; }
.tlui-button__tool::after { inset:4px; border-radius:8px; }
.tlui-button__low::after { content:none; }
.tlui-button[data-isactive=true],.tlui-button__tool[aria-pressed=true],.tlui-button__primary { color:var(--ui-ink); }
.tlui-tooltip { padding:4px 8px; border-radius:var(--tl-radius-2); color:var(--ui-ink); }
.tlui-tooltip__arrow { fill:var(--ui-panel-solid); }
.tlui-slider__track::after,.tlui-slider__range { height:6px; top:calc(50% - 3px); border-radius:3px; }
.tlui-slider__thumb { width:18px; height:18px; border-radius:50%; }
.tlui-input__wrapper .tlui-input,.tlui-page-menu__item__input { border-radius:var(--tl-radius-2); padding:0 8px; }
.tlui-page-menu__item__title::before { border-color:var(--ui-ring); }
.tlui-dialog__header__title { font-weight:550; }
.tlui-dialog__footer__actions .tlui-button::after { inset:6px 4px; }
.tlui-dialog__footer__actions .tlui-button__primary::after { background:var(--ui-ink); box-shadow:inset 0 1px 0 #ffffff59; }
.tlui-dialog__footer__actions .tlui-button__primary { color:var(--ui-panel-solid); }
.desktop-share__trigger.tlui-button::before { background:var(--ui-ink); border-radius:var(--tl-radius-2); box-shadow:inset 0 1px 0 #ffffff59,inset 0 -1px 0 #00000026; }
.desktop-share__trigger.tlui-button::after { background:var(--ui-panel); box-shadow:var(--ui-shadow-attached); }
.desktop-share__trigger.tlui-button:not(:disabled,[data-disabled]):hover::before,.desktop-share__trigger.tlui-button[data-state=open]::before { background:var(--ui-ink-2); }
.desktop-share__trigger.tlui-button { color:var(--ui-panel-solid); }
.tl-container__focused:not(.tl-container__no-focus-ring) .tlui-button:focus-visible { outline:2px solid var(--ui-ring); outline-offset:-2px; border-radius:var(--tl-radius-2); }
@media (prefers-reduced-motion:reduce) { .tlui-button::after { transition:none; } }
`

export const uiCss = tokens + recipes + tldraw
