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
import Gio from 'gi://Gio';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MprisSource } from 'resource:///org/gnome/shell/ui/mpris.js';

class MediaMonitor {
    constructor(onUpdate) {
        this._source = null;
        this._players = new Map();
        this._onUpdate = onUpdate;
    }

    enable() {
        this._source = new MprisSource();
        this._source.connect('player-added', (source, player) => {
            this._addPlayer(player);
        });
        this._source.connect('player-removed', (source, player) => {
            this._removePlayer(player);
        });

        for (const player of this._source.players) {
            this._addPlayer(player);
        }
    }

    disable() {
        if (this._source) {
            this._source = null;
        }

        for (const [player, signalId] of this._players) {
            player.disconnect(signalId);
        }
        this._players.clear();
    }

    _addPlayer(player) {
        if (this._players.has(player)) return;

        const signalId = player.connect('changed', () => {
            this._handlePlayerChange(player);
        });
        this._players.set(player, signalId);

        // Check initial state
        this._handlePlayerChange(player);
    }

    _removePlayer(player) {
        if (this._players.has(player)) {
            const signalId = this._players.get(player);
            player.disconnect(signalId);
            this._players.delete(player);
        }
    }

    _handlePlayerChange(player) {
        if (player.status === 'Playing') {
            const title = player.trackTitle || 'Unknown Title';
            this._onUpdate(title);
        } else if (player.status === 'Paused') {
            // We might want to check if other players are playing before clearing
            // For now, simple logic: if this player paused, clear.
            // But if we have multiple players, this might be racey.
            // Let's iterate all players to see if any is playing.

            let anyPlaying = false;
            let playingTitle = '';

            if (this._source) {
                for (const p of this._source.players) {
                    if (p.status === 'Playing') {
                        anyPlaying = true;
                        playingTitle = p.trackTitle || 'Unknown Title';
                        break;
                    }
                }
            }

            if (anyPlaying) {
                this._onUpdate(playingTitle);
            } else {
                this._onUpdate('');
            }
        } else {
            // For Stopped or other states, also check if others are playing
            let anyPlaying = false;
            let playingTitle = '';

            if (this._source) {
                for (const p of this._source.players) {
                    if (p.status === 'Playing') {
                        anyPlaying = true;
                        playingTitle = p.trackTitle || 'Unknown Title';
                        break;
                    }
                }
            }

            if (anyPlaying) {
                this._onUpdate(playingTitle);
            } else {
                this._onUpdate('');
            }
        }
    }
}

export default class LyriTopExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._box = null;
        this._label = null;

        this._createIndicator();
        this._updatePosition();

        this._mediaMonitor = new MediaMonitor((text) => {
            if (this._label) {
                this._label.text = text;
            }
        });
        this._mediaMonitor.enable();

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

        if (this._mediaMonitor) {
            this._mediaMonitor.disable();
            this._mediaMonitor = null;
        }

        this._destroyIndicator();
        this._settings = null;
    }

    _createIndicator() {
        this._box = new St.BoxLayout({
            style_class: 'panel-button',
        });

        this._label = new St.Label({
            text: 'Hello',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._label);

    }

    _destroyIndicator() {
        if (this._box) {

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
