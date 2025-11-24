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
    constructor(onUpdate, settings) {
        this._source = null;
        this._players = new Map();
        this._onUpdate = onUpdate;
        this._updateTimeoutId = null;
        this._settings = settings;
        this._intervalChangedId = null;
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

        // Start periodic update for position
        this._startPositionUpdate();

        // Listen for interval changes
        this._intervalChangedId = this._settings.connect('changed::update-interval', () => {
            this._stopPositionUpdate();
            this._startPositionUpdate();
        });
    }

    disable() {
        this._stopPositionUpdate();

        if (this._intervalChangedId) {
            this._settings.disconnect(this._intervalChangedId);
            this._intervalChangedId = null;
        }

        if (this._source) {
            this._source = null;
        }

        for (const [player, signalId] of this._players) {
            player.disconnect(signalId);
        }
        this._players.clear();
    }

    _startPositionUpdate() {
        if (this._updateTimeoutId) {
            return;
        }

        // Get update interval from settings (in milliseconds)
        const interval = this._settings.get_uint('update-interval');
        this._updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._updateCurrentPlayer();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPositionUpdate() {
        if (this._updateTimeoutId) {
            GLib.source_remove(this._updateTimeoutId);
            this._updateTimeoutId = null;
        }
    }

    _formatTime(microseconds) {
        if (!microseconds || microseconds < 0) {
            return '0:00';
        }

        const seconds = Math.floor(microseconds / 1000000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    _updateCurrentPlayer() {
        if (!this._source) {
            return;
        }

        // Find the currently playing player
        for (const player of this._source.players) {
            if (player.status === 'Playing') {
                this._updatePlayerInfo(player);
                return;
            }
        }

        // If no player is playing, check for paused players
        for (const player of this._source.players) {
            if (player.status === 'Paused') {
                this._updatePlayerInfo(player);
                return;
            }
        }
    }

    _updatePlayerInfo(player) {
        const title = player.trackTitle || 'Unknown Title';

        // Get position and length from MPRIS D-Bus properties
        let position = 0;
        let length = 0;

        if (player._playerProxy) {
            try {
                // Get track length from metadata
                const metadata = player._playerProxy.Metadata;
                if (metadata && metadata['mpris:length']) {
                    // mpris:length is a GLib.Variant, need to unpack it
                    length = metadata['mpris:length'].unpack();
                }

                // Position is not cached by MPRIS, we need to query it via D-Bus
                try {
                    const connection = player._playerProxy.g_connection;
                    const busName = player._playerProxy.g_name;
                    const objectPath = player._playerProxy.g_object_path;

                    const result = connection.call_sync(
                        busName,
                        objectPath,
                        'org.freedesktop.DBus.Properties',
                        'Get',
                        new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'Position']),
                        new GLib.VariantType('(v)'),
                        Gio.DBusCallFlags.NONE,
                        -1,
                        null
                    );

                    if (result) {
                        // Result is (v) - a variant containing the value
                        const variant = result.get_child_value(0);
                        position = variant.get_variant().get_int64();
                    }
                } catch (e) {
                    console.log('Error calling Position property:', e.message);
                    position = 0;
                }

                console.log('Final position:', position, 'length:', length);
            } catch (e) {
                console.log('Error getting playback info:', e);
            }
        }

        let displayText = title;

        if (length > 0) {
            const currentTime = this._formatTime(position);
            const totalTime = this._formatTime(length);
            displayText = `${title} - ${currentTime} / ${totalTime}`;
        }

        this._onUpdate(displayText);
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
            this._updatePlayerInfo(player);
        } else if (player.status === 'Paused') {
            // We might want to check if other players are playing before clearing
            // For now, simple logic: if this player paused, clear.
            // But if we have multiple players, this might be racey.
            // Let's iterate all players to see if any is playing.

            let anyPlaying = false;

            if (this._source) {
                for (const p of this._source.players) {
                    if (p.status === 'Playing') {
                        anyPlaying = true;
                        this._updatePlayerInfo(p);
                        return;
                    }
                }
            }

            if (!anyPlaying) {
                // Show paused player info
                this._updatePlayerInfo(player);
            }
        } else {
            // For Stopped or other states, also check if others are playing
            let anyPlaying = false;

            if (this._source) {
                for (const p of this._source.players) {
                    if (p.status === 'Playing') {
                        anyPlaying = true;
                        this._updatePlayerInfo(p);
                        return;
                    }
                }
            }

            if (!anyPlaying) {
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
        }, this._settings);
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
