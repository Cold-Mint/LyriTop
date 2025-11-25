# LyriTop

LyriTop is a GNOME Shell extension that displays lyrics in the top bar.

## Installation

### From Source

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Cold-Mint/LyriTop.git
    cd LyriTop
    ```

2.  **Compile Schemas:**
    > [!IMPORTANT]
    > You must compile the GSettings schemas for the extension to work. The compiled file `gschemas.compiled` is not included in the repository.

    ```bash
    glib-compile-schemas schemas/
    ```

3.  **Package:**
    Use the `gnome-extensions` tool to pack the extension into a zip file.
    ```bash
    ./build.sh
    ```
    This will create a file named `lyritop@coldmint.shell-extension.zip` in the current directory.

4.  **Install:**
    Install the extension using the generated zip file.
    ```bash
    gnome-extensions install lyritop@coldmint.shell-extension.zip
    ```

5.  **Enable:**
    ```bash
    gnome-extensions enable lyritop@coldmint
    ```

