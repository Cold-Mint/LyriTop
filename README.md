# LyriTop

LyriTop 是一款 GNOME Shell 扩展程序，它会在顶部栏中显示歌词。

## 本地化

当添加或删除文本后，需要在项目根目录运行以下命令：
```bash
xgettext --from-code=UTF-8 --output=po/lyritop@coldmint.pot *.js
```

生成中文翻译：

```bash
cd po
msginit -i lyritop@coldmint.pot -o zh_CN.po -l zh_CN
```
## 安装

### 从源码构建

1. 克隆该仓库：
```bash
git clone https://github.com/Cold-Mint/LyriTop.git
cd LyriTop
```


2. 打包

使用`gnome-extensions`用于将扩展程序打包成压缩文件的工具。
```bash
gnome-extensions pack --extra-source=./lrcParser.js --extra-source=./lyricsManager.js --extra-source=./mediaMonitor.js  --podir=po .
```
这会在当前目录中创建一个名为`lyritop@coldmint.shell-extension.zip`的文件。

3. 安装

使用生成的压缩文件来安装该扩展程序。
```bash
gnome-extensions install lyritop@coldmint.shell-extension.zip
```

4. 启用扩展

```bash
gnome-extensions enable lyritop@coldmint
```

## 调试运行

```bash
sh ./run-debug.sh
```