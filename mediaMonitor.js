import { MprisSource } from "resource:///org/gnome/shell/ui/mpris.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

/**
 * MediaMonitor
 * 媒体监测器
 */
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
        // 从设置中获取更新间隔（以毫秒为单位）
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
        const title = player.trackTitle;
        const artists = player.trackArtists;
        if (!title || !artists) {
            //If the title or artist is blank, it indicates that the audio is not yet ready.
            // The Gapless music player will send a message with an empty title when enabled.
            // Some online video websites, such as bilibili, send messages with empty artists when playing videos.
            //标题或艺术家为空，则表示音频尚未准备好。
            //Gapless音乐播放器会在启用时发送带有空标题的信息。
            //一些网络视频网站例如bilibili，在播放视频时发送带有空艺术家的信息。
            return;
        }
        if (!player._playerProxy) {
            return;
        }
        // Get position from MPRIS D-Bus properties
        // 从MPRIS D-Bus属性中获取音频播放位置
        let position = 0;
        try {
            const connection = player._playerProxy.g_connection;
            const busName = player._playerProxy.g_name;
            const objectPath = player._playerProxy.g_object_path;
            connection.call(
                busName,
                objectPath,
                'org.freedesktop.DBus.Properties',
                'Get',
                new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'Position']),
                new GLib.VariantType('(v)'),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (source, result) => {
                    try {
                        const response = source.call_finish(result);
                        const variant = response.get_child_value(0);
                        position = variant.get_variant().get_int64();
                        if (this._lyricsManager) {
                            const lyric = this._lyricsManager.getLyric(title + artists, position);
                            if (player.status === 'Playing' && lyric) {
                                let displayText = lyric;
                                if (this._settings.get_boolean('only-show-translation')) {
                                    const parts = lyric.split('  ');
                                    if (parts.length > 1) {
                                        displayText = parts.slice(1);
                                    }
                                }
                                this._onUpdate(displayText);
                            }
                        }
                    } catch (e) {
                        console.error('Error calling Position:', e.message);
                    }
                }
            );

        } catch (e) {
            console.log('Error calling Position property:', e.message);
            position = 0;
        }
    }

    _addPlayer(player) {
        if (this._players.has(player)) {
            return;
        }

        const signalId = player.connect('changed', () => {
            this._handlePlayerChange(player);
        });
        this._players.set(player, signalId);
        this._handlePlayerChange(player);
    }

    _removePlayer(player) {
        if (this._players.has(player)) {
            const signalId = this._players.get(player);
            player.disconnect(signalId);
            this._players.delete(player);
        }
        if (this._players.length === undefined || this._players.size === 0) {
            this._onUpdate('');
        }
    }

    _handlePlayerChange(player) {
        if (player.status === 'Playing') {
            this._updatePlayerInfo(player);
        } else if (player.status === 'Paused') {
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