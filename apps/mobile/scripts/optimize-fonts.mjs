/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import fg from "fast-glob";
import { readFile, writeFile } from "fs/promises";
import Listr from "listr";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { Font } from "fonteditor-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(path.join(__dirname, ".."));
const GLYPH_MAP_PATH = path.join(
  ROOT_DIR,
  "node_modules",
  "react-native-vector-icons",
  "glyphmaps",
  "MaterialCommunityIcons.json"
);
const ICON_FONT_PATH = path.join(
  ROOT_DIR,
  "node_modules",
  "react-native-vector-icons",
  "Fonts",
  "MaterialCommunityIcons.ttf"
);

if (!existsSync(GLYPH_MAP_PATH)) throw new Error("Glyph file not found.");

const glyphs = JSON.parse(await readFile(GLYPH_MAP_PATH, "utf-8"));
const files = await fg("app/**/*.{js,jsx,ts,tsx}");
const pattern = /.name="(.+?)"/gm;
const glyphCodepoints = new Set();

class SilentRenderer {
  static get nonTTY() {
    return true;
  }

  render() {}

  end() {}
}

const tasks = new Listr([], {
  concurrent: os.cpus().length,
  renderer: SilentRenderer
});
for (const filePath of files) {
  tasks.add({
    title: `Searching ${filePath}`,
    task: async () => {
      const file = await readFile(filePath, "utf-8");
      for (const m of file.matchAll(pattern)) {
        if (!glyphs[m[1]]) continue;
        glyphCodepoints.add(glyphs[m[1]]);
      }
    }
  });
}
await tasks.run();

const font = Font.create(await readFile(ICON_FONT_PATH), {
  type: "ttf",
  subset: Array.from(glyphCodepoints.values()),
  hinting: true
});

await writeFile("out.ttf", font.write({ type: "ttf", hinting: true }));
