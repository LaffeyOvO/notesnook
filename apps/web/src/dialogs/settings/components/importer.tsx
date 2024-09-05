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

import { strings } from "@notesnook/intl";
import { Button, Flex, Input, Link, Text } from "@theme-ui/components";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { db } from "../../../common/db";
import { CheckCircleOutline } from "../../../components/icons";
import { useStore as useAppStore } from "../../../stores/app-store";
import { importFiles } from "../../../utils/importer";

export function Importer() {
  const [isDone, setIsDone] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Error[]>([]);
  const notesCounter = useRef<HTMLSpanElement>(null);
  const importProgress = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((files) => {
      const newFiles = [...acceptedFiles, ...files];
      return newFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/zip": [".zip"]
    }
  });

  return (
    <Flex
      sx={{
        flexDirection: "column",
        // justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {isImporting ? (
        <>
          <Text variant="title" sx={{ textAlign: "center", mb: 4, mt: 150 }}>
            <span ref={notesCounter}>0</span> {strings.notesImported()}.
          </Text>

          <Flex
            ref={importProgress}
            sx={{
              alignSelf: "start",
              borderRadius: "default",
              height: "5px",
              bg: "accent",
              width: `0%`
            }}
          />
        </>
      ) : isDone ? (
        <>
          <CheckCircleOutline color="accent" sx={{ mt: 150 }} />
          <Text variant="body" my={2} sx={{ textAlign: "center" }}>
            {strings.importCompleted()}. {strings.errorsOccured(errors.length)}
          </Text>
          <Button
            variant="secondary"
            sx={{ alignSelf: "center" }}
            onClick={async () => {
              setErrors([]);
              setFiles([]);
              setIsDone(false);
              setIsImporting(false);
            }}
          >
            {strings.startOver()}
          </Button>
          {errors.length > 0 && (
            <Flex
              my={1}
              bg="var(--background-error)"
              p={1}
              sx={{ flexDirection: "column" }}
            >
              {errors.map((error) => (
                <Text
                  key={error.message}
                  variant="body"
                  sx={{
                    color: "var(--paragraph-error)"
                  }}
                >
                  {error.message}
                </Text>
              ))}
            </Flex>
          )}
        </>
      ) : (
        <>
          <Flex sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Flex sx={{ flexDirection: "column" }}>
              <Text variant="title">
                {files.length
                  ? strings.filesReadyToImport(files.length)
                  : strings.selectFilesToImport()}
              </Text>
              <Text
                variant={"body"}
                sx={{ color: "var(--paragraph-secondary)" }}
              >
                {strings.importerHelpText()[0]}{" "}
                <Link
                  href="https://help.notesnook.com/importing-notes/import-notes-from-evernote"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: "accent" }}
                >
                  {strings.importerHelpText()[1]}
                </Link>{" "}
                {strings.importerHelpText()[2]}
              </Text>
            </Flex>
            <Button
              variant="accent"
              onClick={async () => {
                setIsDone(false);
                setIsImporting(true);

                await db.syncer?.acquireLock(async () => {
                  try {
                    for await (const message of importFiles(files)) {
                      switch (message.type) {
                        case "error":
                          setErrors((errors) => [...errors, message.error]);
                          break;
                        case "progress": {
                          const { count } = message;
                          if (notesCounter.current)
                            notesCounter.current.innerText = `${count}`;
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    console.error(e);
                    if (e instanceof Error) {
                      setErrors((errors) => [...errors, e as Error]);
                    }
                  }
                });

                await useAppStore.getState().refresh();

                setIsDone(true);
                setIsImporting(false);
              }}
              disabled={!files.length}
            >
              {strings.startImport()}
            </Button>
          </Flex>
          <Flex
            {...getRootProps()}
            data-test-id="import-dialog-select-files"
            sx={{
              justifyContent: "center",
              alignItems: "center",
              height: 200,
              flexShrink: 0,
              width: "full",
              border: "2px dashed var(--border)",
              borderRadius: "default",
              mt: 2,
              flexDirection: "column"
            }}
          >
            <Input {...getInputProps()} />
            <Text variant="body" sx={{ textAlign: "center" }}>
              {isDragActive
                ? strings.dropFilesHere()
                : strings.dragAndDropFiles()}
              <br />
              <Text variant="subBody">{strings.onlyZipSupported()}</Text>
            </Text>
          </Flex>
          <Flex my={1} sx={{ flexDirection: "column" }}>
            {files.map((file, i) => (
              <Text
                key={file.name}
                p={1}
                sx={{
                  ":hover": { bg: "hover" },
                  cursor: "pointer",
                  borderRadius: "default"
                }}
                onClick={() => {
                  setFiles((files) => {
                    const cloned = files.slice();
                    cloned.splice(i, 1);
                    return cloned;
                  });
                }}
                variant="body"
                title={strings.clickToRemove()}
              >
                {file.name}
              </Text>
            ))}
          </Flex>
        </>
      )}
    </Flex>
  );
}
