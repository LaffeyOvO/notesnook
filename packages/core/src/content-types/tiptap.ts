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

import showdown from "@streetwriters/showdown";
import render from "dom-serializer";
import { find, isTag } from "domutils";
import {
  DomNode,
  FormatOptions,
  RecursiveCallback,
  convert
} from "html-to-text";
import { BlockTextBuilder } from "html-to-text/lib/block-text-builder";
import { parseDocument } from "htmlparser2";
import dataurl from "../utils/dataurl";
import {
  HTMLParser,
  extractFirstParagraph,
  getDummyDocument
} from "../utils/html-parser";
import { HTMLRewriter } from "../utils/html-rewriter";
import { ContentBlock } from "../types";
import { InternalLink, parseInternalLink } from "../utils/internal-link";

export type ResolveHashes = (
  hashes: string[]
) => Promise<Record<string, string>>;

const ATTRIBUTES = {
  hash: "data-hash",
  mime: "data-mime",
  filename: "data-filename",
  src: "src",
  href: "href",
  blockId: "data-block-id"
};

(showdown.helper as any).document = getDummyDocument();
const converter = new showdown.Converter();
converter.setFlavor("original");

const splitter = /\W+/gm;
export class Tiptap {
  constructor(private readonly data: string) {}

  toHTML() {
    return this.data;
  }

  toTXT() {
    return convertHtmlToTxt(this.data);
  }

  toMD() {
    return converter.makeMarkdown(this.data);
  }

  toHeadline() {
    return extractFirstParagraph(this.data);
  }

  // isEmpty() {
  //   return this.toTXT().trim().length <= 0;
  // }

  search(query: string) {
    const tokens = query.toLowerCase().split(splitter);
    const lowercase = this.toTXT().toLowerCase();
    return tokens.some((token) => lowercase.indexOf(token) > -1);
  }

  async insertMedia(resolve: ResolveHashes) {
    const hashes: string[] = [];
    new HTMLParser({
      ontag: (name, attr) => {
        const hash = attr[ATTRIBUTES.hash];
        if (name === "img" && hash) hashes.push(hash);
      }
    }).parse(this.data);
    if (!hashes.length) return this.data;

    const images = await resolve(hashes);
    return new HTMLRewriter({
      ontag: (name, attr) => {
        const hash = attr[ATTRIBUTES.hash];
        if (name === "img" && hash) {
          const src = images[hash];
          if (!src) return;
          attr[ATTRIBUTES.src] = src;
        }
      }
    }).transform(this.data);
  }

  async extractBlocks() {
    const nodes: ContentBlock[] = [];
    const document = parseDocument(this.data);

    const elements = find(
      (element) => {
        return isTag(element) && !!element.attribs[ATTRIBUTES.blockId];
      },
      document.childNodes,
      false,
      Infinity
    );

    for (const node of elements) {
      if (!isTag(node)) continue;
      nodes.push({
        id: node.attribs[ATTRIBUTES.blockId],
        type: node.tagName.toLowerCase(),
        content: convertHtmlToTxt(render(node))
      });
    }
    return nodes;
  }

  /**
   * @param {string[]} hashes
   * @returns
   */
  removeAttachments(hashes: string[]) {
    return new HTMLRewriter({
      ontag: (_name, attr) => {
        if (hashes.includes(attr[ATTRIBUTES.hash])) return false;
      }
    }).transform(this.data);
  }

  async postProcess(
    saveAttachment: (
      data: string,
      mime: string,
      filename?: string
    ) => Promise<string | undefined>
  ) {
    if (
      !this.data.includes(ATTRIBUTES.src) &&
      !this.data.includes(ATTRIBUTES.hash) &&
      // check for internal links
      !this.data.includes("nn://")
    )
      return {
        data: this.data,
        hashes: [],
        internalLinks: []
      };

    const internalLinks: InternalLink[] = [];
    const sources: {
      src: string;
      filename?: string;
      mime?: string;
      id: string;
    }[] = [];
    new HTMLParser({
      ontag: (name, attr, pos) => {
        const hash = attr[ATTRIBUTES.hash];
        const src = attr[ATTRIBUTES.src];
        const href = attr[ATTRIBUTES.href];
        if (name === "img" && !hash && src) {
          sources.push({
            src,
            filename: attr[ATTRIBUTES.filename],
            mime: attr[ATTRIBUTES.mime],
            id: `${pos.start}${pos.end}`
          });
        } else if (name === "a" && href && href.startsWith("nn://")) {
          const internalLink = parseInternalLink(href);
          if (!internalLink) return;
          internalLinks.push(internalLink);
        }
      }
    }).parse(this.data);

    const images: Record<string, string | false> = {};
    for (const image of sources) {
      try {
        const { data, mimeType } = dataurl.toObject(image.src);
        if (!data || !mimeType) continue;
        const hash = await saveAttachment(data, mimeType, image.filename);
        if (!hash) continue;

        images[image.id] = hash;
      } catch (e) {
        console.error(e);
        images[image.id] = false;
      }
    }

    const hashes: string[] = [];
    const html = new HTMLRewriter({
      ontag: (name, attr, pos) => {
        switch (name) {
          case "img": {
            const hash = attr[ATTRIBUTES.hash];

            if (hash) {
              hashes.push(hash);
              delete attr[ATTRIBUTES.src];
            } else {
              const hash = images[`${pos.start}${pos.end}`];
              if (!hash) return;

              hashes.push(hash);

              attr[ATTRIBUTES.hash] = hash;
              delete attr[ATTRIBUTES.src];
            }
            break;
          }
          case "iframe":
          case "span": {
            const hash = attr[ATTRIBUTES.hash];
            if (!hash) return;
            hashes.push(hash);
            break;
          }
        }
      }
    }).transform(this.data);

    return {
      data: html,
      hashes,
      internalLinks
    };
  }
}

function convertHtmlToTxt(html: string) {
  return convert(html, {
    wordwrap: 80,
    preserveNewlines: true,
    selectors: [
      { selector: "table", format: "dataTable" },
      { selector: "ul.checklist", format: "taskList" },
      { selector: "ul.simple-checklist", format: "checkList" },
      { selector: "p", format: "paragraph" }
    ],
    formatters: {
      taskList: (elem, walk, builder, formatOptions) => {
        return formatList(elem, walk, builder, formatOptions, (elem) => {
          return elem.attribs.class && elem.attribs.class.includes("checked")
            ? " ✅ "
            : " ☐ ";
        });
      },
      paragraph: (elem, walk, builder) => {
        const { "data-spacing": dataSpacing } = elem.attribs;
        if (elem.parent && elem.parent.name === "li") {
          walk(elem.children, builder);
        } else {
          builder.openBlock({
            leadingLineBreaks: dataSpacing == "single" ? 1 : 2
          });
          walk(elem.children, builder);
          builder.closeBlock({
            trailingLineBreaks: 1
          });
        }
      }
    }
  });
}

function formatList(
  elem: DomNode,
  walk: RecursiveCallback,
  builder: BlockTextBuilder,
  formatOptions: FormatOptions,
  nextPrefixCallback: (elem: DomNode) => string
) {
  const isNestedList = elem?.parent?.name === "li";

  // With Roman numbers, index length is not as straightforward as with Arabic numbers or letters,
  // so the dumb length comparison is the most robust way to get the correct value.
  let maxPrefixLength = 0;
  const listItems = (elem.children || [])
    // it might be more accurate to check only for html spaces here, but no significant benefit
    .filter(
      (child) =>
        child.type !== "text" || (child.data && !/^\s*$/.test(child.data))
    )
    .map(function (child) {
      if (child.name !== "li") {
        return { node: child, prefix: "" };
      }
      const prefix = isNestedList
        ? nextPrefixCallback(child).trimStart()
        : nextPrefixCallback(child);
      if (prefix.length > maxPrefixLength) {
        maxPrefixLength = prefix.length;
      }
      return { node: child, prefix: prefix };
    });
  if (!listItems.length) {
    return;
  }

  builder.openList({
    interRowLineBreaks: 1,
    leadingLineBreaks: isNestedList ? 1 : formatOptions.leadingLineBreaks || 2,
    maxPrefixLength: maxPrefixLength,
    prefixAlign: "left"
  });

  for (const { node, prefix } of listItems) {
    builder.openListItem({ prefix: prefix });
    walk([node], builder);
    builder.closeListItem();
  }

  builder.closeList({
    trailingLineBreaks: isNestedList ? 1 : formatOptions.trailingLineBreaks || 2
  });
}
