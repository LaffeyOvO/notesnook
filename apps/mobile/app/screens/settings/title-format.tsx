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
import { useRef, useState } from "react";
import { db } from "../../common/database";
import Input from "../../components/ui/input";
import React from "react";
import { TextInput } from "react-native";
import Paragraph from "../../components/ui/typography/paragraph";
import { useThemeStore } from "../../stores/use-theme-store";
import { SIZE } from "../../utils/size";

export const TitleFormat = () => {
  const [titleFormat] = useState(db.settings?.getTitleFormat());
  const inputRef = useRef<TextInput>();
  const colors = useThemeStore((state) => state.colors);

  return (
    <>
      <Input
        onSubmit={(e) => {
          db.settings?.setTitleFormat(e.nativeEvent.text);
        }}
        onChangeText={(text) => {
          db.settings?.setTitleFormat(text);
        }}
        containerStyle={{ marginTop: 6 }}
        onLayout={() => {
          inputRef?.current?.setNativeProps({
            text: titleFormat
          });
        }}
        defaultValue={titleFormat}
      />

      <Paragraph style={{ marginTop: 2 }} color={colors.icon} size={SIZE.xs}>
        Use the following key to format the title:{"\n"}
        {"\n"}
        $date$: Current date{"\n"}
        $time$: Current time{"\n"}
        $count$: Number of untitled notes + 1{"\n"}
        $headline$: Use starting line of the note as title{"\n"}
      </Paragraph>
    </>
  );
};
