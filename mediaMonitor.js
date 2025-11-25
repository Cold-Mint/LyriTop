import {MprisSource} from "resource:///org/gnome/shell/ui/mpris.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

 export class MediaMonitor {
    constructor(onUpdate, settings, lyricsManager) {
        this._source = null;
        this._players = new Map();
        this._onUpdate = onUpdate;
        this._updateTimeoutId = null;
        this._settings = settings;
        this._intervalChangedId = null;
        this._lyricsManager = lyricsManager;
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
            } catch (e) {
                console.log('Error getting playback info:', e);
            }
        }

        // Try to get lyrics for current song
        let displayText = '';
        if (this._lyricsManager) {
            const lyric = this._lyricsManager.getLyric(title, position);
            if (lyric) {
                // Display only the current lyric line
                displayText = lyric;
            }
        }

        // If no lyrics found, show default song info with time
        if (!displayText) {
            displayText = title;
            if (length > 0) {
                const currentTime = this._formatTime(position);
                const totalTime = this._formatTime(length);
                displayText = `${title} - ${currentTime} / ${totalTime}`;
            }
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