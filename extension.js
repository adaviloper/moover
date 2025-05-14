import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

let settings;
let keyBindingName = 'move-focused-window';

export default class MooverExtension extends Extension {
    _overlay = null;
    _overlayTimeoutId = null;

    enable() {
        settings = this.getSettings();

        Main.wm.addKeybinding(
            keyBindingName,
            settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => {
                this._resetOverlayTimeout();
                this._showOverlay();
            }
        );
    }

    disable() {
        if (Main.wm.removeKeybinding)
            Main.wm.removeKeybinding(keyBindingName);

        this._removeOverlay();
    }

    _showOverlay() {
        if (this._overlay) return;

        this._overlay = new St.Widget({
            style_class: 'moover-overlay',
            reactive: true,
            can_focus: true,
            track_hover: false,
            layout_manager: new Clutter.BinLayout(),
        });

        Main.layoutManager.addChrome(this._overlay);
        this._overlay.set_size(global.stage.width, global.stage.height);
        this._overlay.set_position(0, 0);
        global.stage.set_key_focus(this._overlay);

        // === Build inner grid ===
        const grid = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            style_class: 'moover-grid',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const cols = [
            [
                '[Q]: Left 1/2',
                '[A]: Left 1/4',
                '[Z]: Left 1/3',
            ],
            [
                '[W]: Second 1/4',
                '[S]: Left 3/4',
                '[X]: Left 2/3',
            ],
            [
                '[E]: Center 2/3',
                '[D]: Center 1/2',
                '[C]: Centered 1/3',
            ],
            [
                '[R]: Third 1/4',
                '[F]: Right 3/4',
                '[V]: Right 2/3',
            ],
            [
                '[T]: Right 1/2',
                '[G]: Right 1/4',
                '[B]: Right 1/3',
            ],
        ];

        const hintLabel = new St.Label({
            text: 'ESC to close menu',
            style_class: 'moover-esc-hint',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        for (const colKeys of cols) {
            const col = new St.BoxLayout({ vertical: true });

            for (const key of colKeys) {
                const label = new St.Label({
                    text: key,
                    style_class: 'moover-key-label',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                col.add_child(label);
            }

            grid.add_child(col);
        }

        this._overlay.add_child(grid);
        // this._overlay.add_child(hintLabel);

        this._overlay.connect('key-press-event', (_, event) => {
            const keyval = event.get_key_symbol();
            if (keyval === Clutter.KEY_Escape) {
                this._removeOverlay();
                return Clutter.EVENT_STOP;
            }

            const key = event.get_key_unicode().toLowerCase();
            this._handleKeyPress(key);
            this._resetOverlayTimeout();

            return Clutter.EVENT_STOP;
        });
    }

    _handleKeyPress(key) {
        const win = global.display.focus_window;
        if (!win) return;

        const monitor = win.get_monitor();
        const geo = global.display.get_monitor_geometry(monitor);
        const menu_offset = 32;
        const padding = 32;

        const positions = {
            ' ': [0, 1],
            'q': [0, 1 / 2],
            'w': [1 / 4, 1 / 4],
            'e': [1 / 6, 2 / 3],
            'r': [1 / 2, 1 / 4],
            't': [1 / 2, 1 / 2],
            'a': [0, 1 / 4],
            's': [0 / 4, 3 / 4],
            'd': [1 / 4, 1 / 2],
            'f': [1 / 4, 3 / 4],
            'g': [3 / 4, 1 / 4],
            'z': [0, 1 / 3],
            'x': [0, 2 / 3],
            'c': [1 / 3, 1 / 3],
            'v': [1 / 3, 2 / 3],
            'b': [2 / 3, 1 / 3],
        };

        if (positions[key]) {
            let [start_frac, width_frac] = positions[key];
            const available_width = geo.width - padding;
            win.move_resize_frame(
                true,
                Math.floor(start_frac * available_width + padding),
                Math.floor(geo.y + 2 * padding),
                Math.floor(available_width * width_frac - padding),
                Math.floor(geo.height - menu_offset - padding * 2)
            );
        }
    }

    _removeOverlay() {
        if (this._overlay) {
            Main.layoutManager.removeChrome(this._overlay)
            this._overlay.destroy();
            this._overlay = null;
        }

        if (this._overlayTimeoutId) {
            GLib.source_remove(this._overlayTimeoutId);
            this._overlayTimeoutId = null;
        }
    }

    _resetOverlayTimeout() {
        if (this._overlayTimeoutId) {
            GLib.source_remove(this._overlayTimeoutId);
            this._overlayTimeoutId = null;
        }

        this._overlayTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            this._removeOverlay();
            return GLib.SOURCE_REMOVE;
        });
    }
}

