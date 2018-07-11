import sharedStyles from "../styles/shared";
import { animateElement } from "../animation";
import { BaseElement, html, property, observe } from "./base.js";
import { Input } from "./input.js";

export class Dialog extends BaseElement {
    @property() open: boolean = false;
    @property() preventDismiss: boolean = false;

    isShowing: boolean = false;
    private _hideTimeout?: number;

    _render() {
        return html`
        <style>
            ${sharedStyles}

            :host {
                display: block;
                @apply --fullbleed;
                position: fixed;
                z-index: 10;
                @apply --scroll;
            }

            :host(:not([open])) {
                pointer-events: none;
            }

            .outer {
                min-height: 100%;
                display: flex;
                position: relative;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 10px;
                box-sizing: border-box;
            }

            .scrim {
                display: block;
                background: var(--color-background);
                opacity: 0;
                transition: opacity 400ms cubic-bezier(0.6, 0, 0.2, 1);
                transform: translate3d(0, 0, 0);
                @apply --fullbleed;
                position: fixed;
            }

            :host([open]) .scrim {
                opacity: 0.90;
            }

            .inner {
                width: 100%;
                box-sizing: border-box;
                max-width: var(--pl-dialog-max-width, 400px);
                z-index: 1;
                --color-background: var(--color-primary);
                --color-foreground: var(--color-tertiary);
                --color-highlight: var(--color-secondary);
                background: var(--color-background);
                color: var(--color-foreground);
                border-radius: var(--border-radius);
                text-shadow: rgba(0, 0, 0, 0.2) 0 2px 0;
                box-shadow: rgba(0, 0, 0, 0.25) 0 0 5px;
                overflow: hidden;

                @apply --pl-dialog-inner;
            }

            .outer {
                transform: translate3d(0, 0, 0);
                /* transition: transform 400ms cubic-bezier(1, -0.3, 0, 1.3), opacity 400ms cubic-bezier(0.6, 0, 0.2, 1); */
                transition: transform 400ms cubic-bezier(0.6, 0, 0.2, 1), opacity 400ms cubic-bezier(0.6, 0, 0.2, 1);
            }

            :host(:not([open])) .outer {
                opacity: 0;
                transform: translate3d(0, 0, 0) scale(0.8);
            }
        </style>

        <div class="scrim"></div>

        <div class="outer" on-click="dismiss">
            <slot name="before"></slot>
            <div id="inner" class="inner" on-click="${(e: Event) => e.stopPropagation()}">
                <slot></slot>
            </div>
            <slot name="after"></slot>
        </div>
`;
    }

    ready() {
        super.ready();
        // window.addEventListener("keydown", (e) => {
        //     if (this.open && (e.key === "Enter" || e.key === "Escape")) {
        //         this.dismiss();
        //         // e.preventDefault();
        //         // e.stopPropagation();
        //     }
        // });
        window.addEventListener("backbutton", e => {
            if (this.open) {
                this.dismiss();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    rumble() {
        animateElement(this.$("#inner"), { animation: "rumble", duration: 200, clear: true });
    }

    @observe("open")
    _openChanged() {
        clearTimeout(this._hideTimeout);

        // Set _display: block_ if we're showing. If we're hiding
        // we need to wait until the transitions have finished before we
        // set _display: none_.
        if (this.open) {
            if (Input.activeInput) {
                Input.activeInput.blur();
            }
            this.style.display = "";
            this.offsetLeft;
            this.isShowing = true;
            this.setAttribute("open", "");
        } else {
            this.removeAttribute("open");
            this._hideTimeout = window.setTimeout(() => {
                this.style.display = "none";
                this.isShowing = false;
            }, 400);
        }

        this.dispatch(this.open ? "dialog-open" : "dialog-close", { dialog: this }, true, true);
    }

    dismiss() {
        if (!this.preventDismiss) {
            this.dispatchEvent(new CustomEvent("dialog-dismiss"));
            this.open = false;
        }
    }
}

window.customElements.define("pl-dialog", Dialog);
