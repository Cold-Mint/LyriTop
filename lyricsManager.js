import Gio from "gi://Gio";
import {LRCParser} from "./lrcParser.js";


export class LyricsManager {
    constructor(settings) {
        this._settings = settings;
        this._songToLyricPath = new Map(); // Map: song title -> lyric file path
        this._lyricCache = new Map(); // Map: lyric file path -> LRCParser
        this._settingsChangedId = null;
    }

    enable() {
        this._loadConfiguration();

        // Listen for changes to lyric files setting
        this._settingsChangedId = this._settings.connect('changed::lyric-files', () => {
            this._loadConfiguration();
        });
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        this._songToLyricPath.clear();
        this._lyricCache.clear();
    }

    _loadConfiguration() {
        this._songToLyricPath.clear();
        this._lyricCache.clear();

        const lyricFiles = this._settings.get_strv('lyric-files');

        for (const jsonPath of lyricFiles) {
            try {
                const file = Gio.File.new_for_path(jsonPath);
                const [success, contents] = file.load_contents(null);

                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonText = decoder.decode(contents);
                    const config = JSON.parse(jsonText);

                    // Process each song mapping
                    for (const entry of config) {
                        if (entry.title && entry.path) {
                            this._songToLyricPath.set(entry.title, entry.path);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error loading lyric configuration from ${jsonPath}:`, e.message);
            }
        }
    }

    // Get lyric for a song title at specific position
    getLyric(songTitle, position) {
        if (!songTitle) {
            return null;
        }

        // Find lyric file path for this song
        const lyricPath = this._songToLyricPath.get(songTitle);
        if (!lyricPath) {
            return null;
        }

        // Check cache first
        let parser = this._lyricCache.get(lyricPath);
        if (!parser) {
            // Load and parse LRC file
            try {
                const file = Gio.File.new_for_path(lyricPath);
                const [success, contents] = file.load_contents(null);

                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const lrcText = decoder.decode(contents);

                    parser = new LRCParser();
                    parser.parse(lrcText);
                    this._lyricCache.set(lyricPath, parser);
                }
            } catch (e) {
                console.error(`Error loading lyric file ${lyricPath}:`, e.message);
                return null;
            }
        }

        return parser ? parser.getLyricAtPosition(position) : null;
    }
}