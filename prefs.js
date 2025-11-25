import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
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

        const updateIntervalRow = new Adw.SpinRow({
            title: _('Update Interval (ms)'),
            subtitle: _('How often to update playback position'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 1000,
                step_increment: 1,
            }),
        });
        group.add(updateIntervalRow);

        settings.bind(
            'update-interval',
            updateIntervalRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        const onlyShowTranslationRow = new Adw.SwitchRow({
            title: _('Only Show Translation'),
            subtitle: _('If enabled, only show the translation part of the lyrics'),
        });
        group.add(onlyShowTranslationRow);

        settings.bind(
            'only-show-translation',
            onlyShowTranslationRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        const lyricAdvanceRow = new Adw.SpinRow({
            title: _('Lyric Advance Time (ms)'),
            subtitle: _('Advance lyrics display. Positive values show lyrics earlier, negative values delay them'),
            adjustment: new Gtk.Adjustment({
                lower: -5000,
                upper: 5000,
                step_increment: 50,
            }),
        });
        group.add(lyricAdvanceRow);

        settings.bind(
            'lyric-advance-ms',
            lyricAdvanceRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Lyric files group
        const lyricGroup = new Adw.PreferencesGroup({
            title: _('Lyrics Configuration'),
            description: _('Manage JSON files containing song title to lyric file mappings'),
        });
        page.add(lyricGroup);

        // Create a list box to display lyric files
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['boxed-list'],
        });
        lyricGroup.add(listBox);

        // Function to update the list
        const updateList = () => {
            // Remove all existing rows
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }

            // Add current lyric files
            const lyricFiles = settings.get_strv('lyric-files');
            for (const filePath of lyricFiles) {
                const row = new Adw.ActionRow({
                    title: filePath,
                });
                listBox.append(row);
            }
        };

        // Initial list update
        updateList();

        // Listen for changes
        settings.connect('changed::lyric-files', updateList);

        // Add button
        const addButton = new Gtk.Button({
            label: _('Add Lyric Configuration File'),
            margin_top: 10,
        });
        lyricGroup.add(addButton);

        addButton.connect('clicked', () => {
            const fileDialog = new Gtk.FileDialog({
                title: _('Select JSON Configuration File'),
            });

            fileDialog.open(window, null, (dialog, result) => {
                try {
                    const file = dialog.open_finish(result);
                    if (file) {
                        const filePath = file.get_path();
                        const currentFiles = settings.get_strv('lyric-files');
                        if (!currentFiles.includes(filePath)) {
                            currentFiles.push(filePath);
                            settings.set_strv('lyric-files', currentFiles);
                        }
                    }
                } catch (e) {
                    // User cancelled or error occurred
                }
            });
        });

        // Remove button
        const removeButton = new Gtk.Button({
            label: _('Remove Selected File'),
            margin_top: 5,
            css_classes: ['destructive-action'],
        });
        lyricGroup.add(removeButton);

        removeButton.connect('clicked', () => {
            const selectedRow = listBox.get_selected_row();
            if (selectedRow) {
                const filePath = selectedRow.get_title();
                const currentFiles = settings.get_strv('lyric-files');
                const index = currentFiles.indexOf(filePath);
                if (index > -1) {
                    currentFiles.splice(index, 1);
                    settings.set_strv('lyric-files', currentFiles);
                }
            }
        });
    }
}
