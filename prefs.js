import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LyriTopPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        page.add(group);
        window.add(page);

        const row = new Adw.ComboRow({
            title: _('Indicator Position'),
            model: new Gtk.StringList({
                strings: ['Left', 'Center', 'Right']
            }),
        });

        group.add(row);

        const settings = this.getSettings();

        // Map index to string value
        const positions = ['left', 'center', 'right'];

        // Bind settings to combo row
        row.selected = positions.indexOf(settings.get_string('position'));

        row.connect('notify::selected', () => {
            settings.set_string('position', positions[row.selected]);
        });

        const offsetRow = new Adw.SpinRow({
            title: _('Indicator Offset'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 20,
                step_increment: 1,
            }),
        });
        group.add(offsetRow);

        settings.bind(
            'offset',
            offsetRow,
            'value',
            0
        );
    }
}
