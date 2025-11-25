import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MediaMonitor} from './mediaMonitor.js'
import {LyricsManager} from "./lyricsManager.js";

export default class LyriTopExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._updatePosition();

        // Initialize lyrics manager
        this._lyricsManager = new LyricsManager(this._settings);
        this._lyricsManager.enable();

        this._mediaMonitor = new MediaMonitor((text) => {
            if (this._label) {
                this._label.text = text;
            }
        }, this._settings, this._lyricsManager);
        this._mediaMonitor.enable();

        this._positionChangedId = this._settings.connect('changed::position', () => {
            this._updatePosition();
        });

        this._offsetChangedId = this._settings.connect('changed::offset', () => {
            this._updatePosition();
        });
    }

    disable() {
        if (this._positionChangedId) {
            this._settings.disconnect(this._positionChangedId);
            this._positionChangedId = null;
        }

        if (this._offsetChangedId) {
            this._settings.disconnect(this._offsetChangedId);
            this._offsetChangedId = null;
        }

        if (this._mediaMonitor) {
            this._mediaMonitor.disable();
            this._mediaMonitor = null;
        }

        if (this._lyricsManager) {
            this._lyricsManager.disable();
            this._lyricsManager = null;
        }

        if (this._label) {
            this._label.destroy();
            this._label = null;
        }
        this._settings = null;
    }

    _updatePosition() {
        if (!this._label) {
            return;
        }
        let parent = this._label.get_parent()
        if (parent) {
            parent.remove_child(this._label);
        }
        const position = this._settings.get_string('position');
        const offset = this._settings.get_uint('offset');
        let panelBox;
        if (position === 'left') {
            panelBox = Main.panel._leftBox;
        } else if (position === 'center') {
            panelBox = Main.panel._centerBox;
        } else {
            panelBox = Main.panel._rightBox;
        }
        const children = panelBox.get_children();
        let index = offset;
        if (index > children.length) {
            index = children.length;
        }
        panelBox.insert_child_at_index(this._label, index);
    }
}
