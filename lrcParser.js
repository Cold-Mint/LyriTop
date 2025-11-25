export class LRCParser {
    constructor() {
        this.lyrics = [];
    }

    // Parse LRC file content
    parse(content) {
        this.lyrics = [];
        const lines = content.split('\n');

        for (const line of lines) {
            // Match timestamp pattern [mm:ss.xx] or [mm:ss]
            const match = line.match(/\[(\d+):(\d+)(?:\.(\d+))?\](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const centiseconds = match[3] ? parseInt(match[3]) : 0;
                const text = match[4].trim();

                // Convert to microseconds for MPRIS compatibility
                const timeInMicroseconds = (minutes * 60 + seconds) * 1000000 + centiseconds * 10000;

                this.lyrics.push({
                    time: timeInMicroseconds,
                    text: text
                });
            }
        }

        // Sort by time
        this.lyrics.sort((a, b) => a.time - b.time);
    }

    // Get lyric for specific position (in microseconds)
    getLyricAtPosition(position) {
        if (this.lyrics.length === 0) {
            return null;
        }

        // Find the lyric line that should be displayed at this position
        let currentLyric = null;
        for (const lyric of this.lyrics) {
            if (lyric.time <= position) {
                currentLyric = lyric;
            } else {
                break;
            }
        }

        return currentLyric ? currentLyric.text : null;
    }
}