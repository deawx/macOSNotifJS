/**
 *  macOSNotifJS: A simple Javascript plugin to create simulated macOS notifications on your website.
 *  <https://github.com/MattIPv4/macOSNotifJS/>
 *  Copyright (C) 2018 Matt Cowley (MattIPv4) (me@mattcowley.co.uk)
 *
 *  This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *  This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *  You should have received a copy of the GNU Affero General Public License
 *   along with this program. If not, please see
 *   <https://github.com/MattIPv4/macOSNotifJS/blob/master/LICENSE> or <http://www.gnu.org/licenses/>.
 */

class __macOSNotifJS_Interact {

    constructor(element) {
        this.element = typeof(element) === "string" ? document.querySelector(element) : element;

        this.drag_acting = false;
        this.drag_xOrg = null;
        this.drag_xOffset = 0;
    }

    onDismiss(callback) {
        this.onDismiss = callback;
        return this;
    }

    scroll_move(evt) {
        if (!evt.deltaX) return;
        if (evt.deltaX < 0) this.onDismiss();
    }

    scroll_run() {
        this.element.addEventListener("wheel", (evt) => this.scroll_move(evt), true);
    }

    drag_move(evt) {
        if (!this.drag_acting) return;
        evt.preventDefault();
        evt.stopPropagation();

        let position = this.drag_xOffset + this.drag_xOrg;
        if (evt.type === "mousemove") {
            position -= evt.clientX;
        } else if (evt.type === "touchmove") {
            position -= evt.targetTouches[0].clientX;
        }
        if (position > this.drag_xOrg) position = this.drag_xOrg;

        this.element.style.transition = "unset";
        this.element.style.right = position + "px";
    }

    drag_rightOffset() {
        const thisRect = this.element.getBoundingClientRect();
        const parentRect = this.element.parentElement.getBoundingClientRect();
        return parentRect.right - thisRect.right;
    }

    drag_start(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        if (evt.type === "mousedown") {
            this.drag_xOffset = evt.clientX;
        } else if (evt.type === "touchstart") {
            this.drag_xOffset = evt.targetTouches[0].clientX;
        }

        if (this.drag_xOrg === null) this.drag_xOrg = this.drag_rightOffset();
        this.drag_acting = true;
    }

    drag_stop(evt) {
        if (!this.drag_acting) return;
        evt.preventDefault();
        evt.stopPropagation();

        // Reset transition and stop dragging
        this.element.style.transition = "";
        this.drag_acting = false;

        // Check if we should dismiss
        const offset = Math.abs(this.drag_rightOffset());
        const threshold = this.element.offsetWidth * 0.2;
        if (offset >= threshold) {
            this.onDismiss();
        } else {
            this.element.style.right = this.drag_xOrg + "px";
        }
    }

    drag_run() {
        this.element.addEventListener("mousedown", (evt) => this.drag_start(evt), true);
        this.element.addEventListener("touchstart", (evt) => this.drag_start(evt), true);

        window.addEventListener("mousemove", (evt) => this.drag_move(evt), true);
        window.addEventListener("touchmove", (evt) => this.drag_move(evt), true);

        window.addEventListener("mouseup", (evt) => this.drag_stop(evt), true);
        window.addEventListener("touchend", (evt) => this.drag_stop(evt), true);
    }

    run() {
        this.drag_run();

        // TODO: this
        //this.scroll_run();
    }
}

let __macOSNotifJS_template = null;
const __macOSNotifJS_notifs = {};
const __macOSNotifJS_src = document.currentScript.src.substr(0, document.currentScript.src.lastIndexOf("/"));
const __macOSNotifJS_fadeThreshold = 4;

class macOSNotifJS {

    constructor(options) {
        const defaultOptions = {
            delay: 0.5,                             // Delay before display (in seconds)
            autoDismiss: 0,                         // Delay till automatic dismiss (0 = Never, in seconds)
            interactDismiss: true,                  // Toggle swipe/drag to dismiss
            sounds: false,                          // Play sounds for notification
            zIndex: 5000,                           // The css z-index value of the notification
            imageSrc: null,                         // Link of the icon to display (null to hide icon)
            imageName: "",                          // Alt/Title text of the icon
            imageLink: null,                        // Link for icon click (null for no link, '#' for dismiss)
            title: "macOSNotifJS",                  // Main Notif Title
            subtitle: "Default notification text",  // Main Notif Sub Title
            mainLink: null,                         // Link for the main text body (null for no link, '#' for dismiss)
            btn1Text: "Close",                      // Text for Button 1 (null to hide all buttons)
            btn1Link: null,                         // Link for Button 1 (null or '#' for dismiss only)
            btn2Text: "Go",                         // Text for Button 2 (null to hide second button)
            btn2Link: null,                         // Link for Button 2 (null or '#' for dismiss only)
        };

        // Load our options
        this.options = { ...defaultOptions, ...options };

        // Other properties
        this.container = null;
        this.id = null;
        this.interact = null;
        this.dismissing = false;
    }

    static __loadCSS() {
        if (document.getElementById("macOSNotifJS_CSS")) return;

        const css = document.createElement("link");
        css.id = "macOSNotifJS_CSS";
        css.rel = "stylesheet";
        css.type = "text/css";
        css.href = __macOSNotifJS_src + "/res/macOSNotif.min.css";

        document.head.appendChild(css);
    }

    static async __loadTemplate() {
        if (__macOSNotifJS_template) return;

        // Generate template url
        const src = __macOSNotifJS_src + "/res/macOSNotif.min.html";

        // Get the template
        const response = await fetch(src);
        __macOSNotifJS_template = (await response.text()).replace(/<!--[\s\S]*?(?:-->)/g, "");
    }

    static __fullId(id) {
        return "macOSNotifJS_n" + id.toString();
    }

    static __nextId() {
        // Handle empty
        if (!__macOSNotifJS_notifs || Object.keys(__macOSNotifJS_notifs).length === 0) return 0;

        // Get max
        const keys = Object.keys(__macOSNotifJS_notifs).map(Number);
        return Math.max(...keys) + 1;
    }

    static async __generateTemplate() {
        // Ensure we have the template
        await macOSNotifJS.__loadTemplate();

        // Get the template and insert the id
        let template = __macOSNotifJS_template;
        const id = macOSNotifJS.__nextId();
        __macOSNotifJS_notifs[id] = null;
        template = template.replace(/macOSNotifJS_/g, macOSNotifJS.__fullId(id) + "_");

        // Return template and the ID of it
        return { template, id };
    }

    static __generateAudio() {
        // If already exists, return it
        const element = document.getElementById("macOSNotifJS_Audio");
        if (element) return element;

        // Create new audio
        const audio = document.createElement("audio");
        audio.id = "macOSNotifJS_Audio";
        audio.autoplay = false;
        audio.volume = 1;
        audio.controls = false;
        audio.preload = "auto";

        // Create sources
        const sourceMp3 = document.createElement("source");
        sourceMp3.src = __macOSNotifJS_src + "/res/audio/macOSNotif.mp3";
        sourceMp3.type = "audio/mpeg";
        audio.appendChild(sourceMp3);
        const sourceOgg = document.createElement("source");
        sourceOgg.src = __macOSNotifJS_src + "/res/audio/macOSNotif.ogg";
        sourceOgg.type = "audio/ogg";
        audio.appendChild(sourceOgg);

        // Add to DOM and return
        document.body.appendChild(audio);
        return audio;
    }

    static __getElements(id) {
        // Get the full ID
        const fullId = macOSNotifJS.__fullId(id) + "_";

        // Get all the elements
        const Outer = document.getElementById(fullId + "Outer");
        const Container = document.getElementById(fullId + "Container");
        const Img = document.getElementById(fullId + "Img");
        const Image = document.getElementById(fullId + "Image");
        const Text = document.getElementById(fullId + "Text");
        const Title = document.getElementById(fullId + "Title");
        const Subtitle = document.getElementById(fullId + "Subtitle");
        const Buttons = document.getElementById(fullId + "Buttons");
        const Button1 = document.getElementById(fullId + "Button1");
        const Button2 = document.getElementById(fullId + "Button2");

        // Return
        return { Outer, Container, Img, Image, Text, Title, Subtitle, Buttons, Button1, Button2 };
    }

    static __dismissAll() {
        Object.values(__macOSNotifJS_notifs).forEach(
            value => value.__dismiss(),
        );
    }

    static __doAfter(id, callback) {
        for (const key in __macOSNotifJS_notifs) {
            if (!__macOSNotifJS_notifs.hasOwnProperty(key)) continue;
            if (parseInt(key) < id) __macOSNotifJS_notifs[key][callback]();
        }
    }

    static __dismissAfter(id) {
        macOSNotifJS.__doAfter(id, "__dismiss");
    }

    static __shiftDownAfter(id) {
        macOSNotifJS.__doAfter(id, "__shiftDown");
    }

    static __shiftUpAfter(id) {
        macOSNotifJS.__doAfter(id, "__shiftUp");
    }

    __shift(type) {
        // Move up/down
        const outer = this.container.parentElement;
        const newPos = outer.getBoundingClientRect().top + (outer.offsetHeight * type);
        outer.style.top = newPos + "px";

        // Calculate notifications above
        const elmsAbove = Object.entries(__macOSNotifJS_notifs)
            .reduce((elmsAboveSoFar, [key, { dismissing }]) => (
                elmsAboveSoFar + Number(Number(key) > this.id && dismissing)
            ), 0);

        // Handle show/hide overflow
        if (type === 1) {
            // Down
            if (elmsAbove >= __macOSNotifJS_fadeThreshold) {
                this.container.style.opacity = "0";
            }
        } else {
            // Up
            if (elmsAbove < __macOSNotifJS_fadeThreshold) {
                this.container.style.opacity = "1";
            }
        }
    }

    __shiftDown() {
        this.__shift(1);
    }

    __shiftUp() {
        this.__shift(-1);
    }

    __dismiss() {
        // Let others know
        this.dismissing = true;

        // Get our ids
        const fullId = macOSNotifJS.__fullId(this.id);

        // Animate dismissal
        this.container.parentElement.style.pointerEvents = "none";
        this.container.style.right = -this.container.parentElement.offsetWidth + "px";
        this.container.style.opacity = "0.1";
        macOSNotifJS.__shiftUpAfter(this.id);

        // Clear the autodismiss if applicable
        if (window[fullId + "_AutoDismiss"]) {
            clearTimeout(window[fullId + "_AutoDismiss"]);
            delete window[fullId + "_AutoDismiss"];
        }

        // Clear the onclick handlers
        if (window[fullId + "_ButtonMain"]) delete window[fullId + "_ButtonMain"];
        if (window[fullId + "_Button1"]) delete window[fullId + "_Button1"];
        if (window[fullId + "_Button2"]) delete window[fullId + "_Button2"];

        // Remove fully once animation completed
        setTimeout(() => {
            this.container.parentElement.remove();
            delete __macOSNotifJS_notifs[this.id];
        }, 800);
    }

    __handleGo(link, nullNoDismiss) {
        if (typeof(nullNoDismiss) === "undefined") nullNoDismiss = false;

        if (link === "#" || (link === null && !nullNoDismiss)) this.__dismiss();
        if (link === "#" || link === null) return;

        setTimeout(() => {
            window.location.href = link;
        }, 800);
        this.__dismiss();
    }

    async run() {
        // Generate the base template
        macOSNotifJS.__loadCSS();
        const templateData = await macOSNotifJS.__generateTemplate();
        this.id = templateData.id;

        // Add the notification to DOM
        document.body.insertAdjacentHTML("beforeend", templateData.template);

        // Find the container
        const { Container, Img, Image, Text, Title, Subtitle, Buttons, Button1, Button2 } = macOSNotifJS.__getElements(this.id);
        this.container = Container;
        this.container.setAttribute("data-id", this.id);

        // Apply user defined options
        this.container.parentElement.style.zIndex = (this.options.zIndex + this.id).toString();
        if (this.options.imageSrc !== null) {
            if (this.options.imageLink !== null) {
                Image.classList.add("macOSNotif_Clickable");
            }
            Image.src = this.options.imageSrc;
            Image.alt = this.options.imageName;
            Image.title = this.options.imageName;
        } else {
            Img.remove();
        }
        Title.textContent = this.options.title;
        Subtitle.textContent = this.options.subtitle;
        if (this.options.mainLink !== null) {
            Text.classList.add("macOSNotif_Clickable");
        }
        if (this.options.btn1Text !== null) {
            Button1.textContent = this.options.btn1Text;
            if (this.options.btn2Text !== null) {
                Button2.textContent = this.options.btn2Text;
            } else {
                Button1.classList.add("macOSNotif_ButtonFull");
                Button2.remove();
            }
        } else {
            Text.classList.add("macOSNotif_TextFull");
            Buttons.remove();
        }

        // Interact dismiss
        if (this.options.interactDismiss) {
            this.interact = new __macOSNotifJS_Interact(this.container);
            this.interact.onDismiss(() => {
                this.__dismiss();
            }).run();
        }

        // Set the actions
        const fullId = macOSNotifJS.__fullId(this.id);
        window[fullId + "_ButtonImg"] = () => {
            this.__handleGo(this.options.imageLink, true);
        };
        window[fullId + "_ButtonMain"] = () => {
            this.__handleGo(this.options.mainLink, true);
        };
        window[fullId + "_Button1"] = () => {
            this.__handleGo(this.options.btn1Link);
        };
        window[fullId + "_Button2"] = () => {
            this.__handleGo(this.options.btn2Link);
        };

        // Set autodismiss
        if (this.options.autoDismiss !== 0) {
            window[fullId + "_AutoDismiss"] = setTimeout(() => {
                this.__dismiss();
            }, (this.options.autoDismiss * 1000) + (this.options.delay * 1000));
        }

        // Handle show
        setTimeout(() => {
            // Stop overlapping
            macOSNotifJS.__shiftDownAfter(this.id);

            // Do sound
            if (this.options.sounds) macOSNotifJS.__generateAudio().play();

            // Show
            this.container.style.right = "15px";
            this.container.style.opacity = "1";
        }, this.options.delay * 1000);

        // Save
        __macOSNotifJS_notifs[this.id] = this;
    }
}

// eslint-disable-next-line no-unused-vars
async function macOSNotif(options) {
    // A quick method for generating a full instance of macOSNotifJS and running it
    return (new macOSNotifJS(options)).run();
}
