import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MediaMonitor} from './mediaMonitor.js'
import {LyricsManager} from "./lyricsManager.js";

export default class LyriTopExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._box = null;
        this._label = null;

        this._createIndicator();
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

        if (this._lyricsManager) {
            this._lyricsManager.disable();
            this._lyricsManager = null;
        }

        this._destroyIndicator();
        this._settings = null;
    }

    _createIndicator() {
        this._box = new St.BoxLayout({
            style_class: 'panel-button',
        });

        this._label = new St.Label({
            text: '',
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


        if (index > children.length) {
            index = children.length;
        }

        panelBox.insert_child_at_index(this._box, index);
    }
}
