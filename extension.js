/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class LyriTopExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._box = null;
        this._label = null;

        this._createIndicator();
        this._updatePosition();

        this._settingsChangedId = this._settings.connect('changed::position', () => {
            this._updatePosition();
        });

        this._offsetChangedId = this._settings.connect('changed::offset', () => {
            this._updatePosition();
        });
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._offsetChangedId) {
            this._settings.disconnect(this._offsetChangedId);
            this._offsetChangedId = null;
        }

        this._destroyIndicator();
        this._settings = null;
    }

    _createIndicator() {
        this._box = new St.BoxLayout({
            style_class: 'panel-button',
            reactive: true,
            track_hover: true,
        });

        this._label = new St.Label({
            text: 'Hello',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._label);

        this._clickId = this._box.connect('button-press-event', () => {
            this.openPreferences();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _destroyIndicator() {
        if (this._box) {
            if (this._clickId) {
                this._box.disconnect(this._clickId);
                this._clickId = null;
            }

            if (this._box.get_parent()) {
                this._box.get_parent().remove_child(this._box);
            }

            this._box.destroy();
            this._box = null;
            this._label = null;
        }
    }

    _updatePosition() {
        if (!this._box) return;

        // Remove from current parent if exists
        if (this._box.get_parent()) {
            this._box.get_parent().remove_child(this._box);
        }

        const position = this._settings.get_string('position');
        const offset = this._settings.get_uint('offset');
        let panelBox;

        if (position === 'left') {
            panelBox = Main.panel._leftBox;
        } else if (position === 'center') {
            panelBox = Main.panel._centerBox;
        } else {
            // Default to right
            panelBox = Main.panel._rightBox;
        }

        const children = panelBox.get_children();
        let index = offset;

        // Clamp index to be within valid range (0 to children.length)
        // Note: We are adding a new child, so valid index is up to children.length
        if (index > children.length) {
            index = children.length;
        }

        panelBox.insert_child_at_index(this._box, index);
    }
}
