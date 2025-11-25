export class LRCParser {
    constructor() {
        this.lyrics = [];
        this.lastPlayedIndex = -1; // Pointer to the last played lyric index
    }

    // Parse LRC file content
    // 解析LRC文件内容
    parse(content) {
        this.lyrics = [];
        const lines = content.split('\n');

        for (const line of lines) {
            // Match timestamp pattern [mm:ss.xx] or [mm:ss]
            // 匹配时间戳模式[mm:ss]或[mm:ss]
            const match = line.match(/\[(\d+):(\d+)(?:\.(\d+))?](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const centiseconds = match[3] ? parseInt(match[3]) : 0;
                const text = match[4].trim();

                // Convert to microseconds for MPRIS compatibility
                // 转换为微秒以兼容MPRIS
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

    /**
     * Get lyric for specific position (in microseconds)
     * 获取特定位置的歌词（以微秒为单位）
     * @param position
     * @returns {*|null}
     */
    getLyricAtPosition(position) {
        if (this.lyrics.length === 0) {
            return null;
        }

        // If the current position is less than the last playback position,
        // it indicates that you have rolled back and reset the search starting point
        // 如果当前位置小于上次的播放位置，表示回退了，重置搜索起点
        let startIndex;
        if (this.lastPlayedIndex === -1 || position < this.lyrics[this.lastPlayedIndex].time) {
            // If you have rolled back, or it is the first time to play, search from the beginning again
            // 如果回退了或者是第一次播放，重新从头查找
            startIndex = 0;
        } else {
            // Look backward and continue from the last playback position
            // 向后查找，继续从上次播放位置开始
            startIndex = this.lastPlayedIndex;
        }
        for (let i = startIndex; i < this.lyrics.length; i++) {
            const lyric = this.lyrics[i];

            // If the lyrics time is less than or equal to the current position, update the lastPlayedIndex
            // 如果歌词时间小于或等于当前位置，更新 lastPlayedIndex
            if (lyric.time <= position) {
                this.lastPlayedIndex = i;
            } else {
                break;
            }
        }

        // Return the found lyrics text
        // 返回找到的歌词文本
        return this.lastPlayedIndex !== -1 ? this.lyrics[this.lastPlayedIndex].text : null;
    }
}