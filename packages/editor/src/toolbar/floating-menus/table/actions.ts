import { Theme } from "@notesnook/theme";
import { Slider } from "@rebass/forms";
import { Editor, findParentNodeClosestToPos } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flex, Text } from "rebass";
import {
  ActionSheetPresenter,
  MenuPresenter,
} from "../../../components/menu/menu";
import {
  getElementPosition,
  MenuOptions,
} from "../../../components/menu/useMenu";
import { Popup } from "../../components/popup";
import { ToolButton, ToolButtonProps } from "../../components/tool-button";
import { IconNames } from "../../icons";
// import { ColorPicker, DEFAULT_COLORS } from "../tools/colors";
import { FloatingMenuProps } from "../types";
import { selectedRect, TableMap, TableRect } from "prosemirror-tables";
import { Transaction } from "prosemirror-state";
import { MenuItem } from "../../../components/menu/types";
import { DesktopOnly, MobileOnly } from "../../../components/responsive";
import { ToolProps } from "../../types";

function moveColumnRight(editor: Editor) {
  const { tr } = editor.state;
  const rect = selectedRect(editor.state);
  if (rect.right === rect.map.width) return;

  const transaction = moveColumn(tr, rect, rect.left, rect.left + 1);
  if (!transaction) return;

  editor.view.dispatch(transaction);
}

function moveColumnLeft(editor: Editor) {
  const { tr } = editor.state;
  const rect = selectedRect(editor.state);
  if (rect.left === 0) return;

  const transaction = moveColumn(tr, rect, rect.left, rect.left - 1);
  if (!transaction) return;

  editor.view.dispatch(transaction);
}

function moveRowDown(editor: Editor) {
  const { tr } = editor.state;
  const rect = selectedRect(editor.state);
  if (rect.top + 1 === rect.map.height) return;

  const transaction = moveRow(tr, rect, rect.top, rect.top + 1);
  if (!transaction) return;

  editor.view.dispatch(transaction);
}

function moveRowUp(editor: Editor) {
  const { tr } = editor.state;
  const rect = selectedRect(editor.state);
  if (rect.top === 0) return;

  const transaction = moveRow(tr, rect, rect.top, rect.top - 1);
  if (!transaction) return;

  editor.view.dispatch(transaction);
}

function moveColumn(
  tr: Transaction<any>,
  rect: TableRect,
  from: number,
  to: number
) {
  let fromCells = getColumnCells(rect, from);
  let toCells = getColumnCells(rect, to);

  return moveCells(tr, rect, fromCells, toCells);
}

function getColumnCells({ map, table }: TableRect, col: number) {
  let cells = [];
  for (let row = 0; row < map.height; ) {
    let index = row * map.width + col;
    if (index >= map.map.length) break;

    let pos = map.map[index];

    let cell = table.nodeAt(pos);
    if (!cell) continue;
    cells.push({ cell, pos });

    row += cell.attrs.rowspan;
    console.log(cell.textContent);
  }

  return cells;
}

function moveRow(
  tr: Transaction<any>,
  rect: TableRect,
  from: number,
  to: number
) {
  let fromCells = getRowCells(rect, from);
  let toCells = getRowCells(rect, to);
  return moveCells(tr, rect, fromCells, toCells);
}

function getRowCells({ map, table }: TableRect, row: number) {
  let cells = [];
  for (let col = 0, index = row * map.width; col < map.width; col++, index++) {
    if (index >= map.map.length) break;

    let pos = map.map[index];
    let cell = table.nodeAt(pos);

    if (!cell) continue;
    cells.push({ cell, pos });

    col += cell.attrs.colspan - 1;
  }

  return cells;
}

function moveCells(
  tr: Transaction<any>,
  rect: TableRect,
  fromCells: any[],
  toCells: any[]
) {
  if (fromCells.length !== toCells.length) return;
  let mapStart = tr.mapping.maps.length;

  for (let i = 0; i < toCells.length; ++i) {
    const fromCell = fromCells[i];
    const toCell = toCells[i];

    let fromStart = tr.mapping
      .slice(mapStart)
      .map(rect.tableStart + fromCell.pos);
    let fromEnd = fromStart + fromCell.cell.nodeSize;
    const fromSlice = tr.doc.slice(fromStart, fromEnd);

    const toStart = tr.mapping
      .slice(mapStart)
      .map(rect.tableStart + toCell.pos);
    const toEnd = toStart + toCell.cell.nodeSize;
    const toSlice = tr.doc.slice(toStart, toEnd);

    tr.replace(toStart, toEnd, fromSlice);

    fromStart = tr.mapping.slice(mapStart).map(rect.tableStart + fromCell.pos);
    fromEnd = fromStart + fromCell.cell.nodeSize;
    tr.replace(fromStart, fromEnd, toSlice);
  }

  return tr;
}

export { moveColumnLeft, moveColumnRight, moveRowDown, moveRowUp };
