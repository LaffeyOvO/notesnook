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

import { db } from "./db";
import { showPasswordDialog } from "./dialog-controller";
import { showToast } from "../utils/toast";
import { VAULT_ERRORS } from "@notesnook/core/dist/api/vault";

class Vault {
  static async createVault() {
    if (await db.vault.exists()) return false;
    return await showPasswordDialog("create_vault", async ({ password }) => {
      if (!password) return false;
      await db.vault.create(password);
      showToast("success", "Vault created.");
      return true;
    });
  }

  static async clearVault() {
    if (!(await db.vault.exists())) return false;
    return await showPasswordDialog("clear_vault", async ({ password }) => {
      if (!password) return false;
      try {
        await db.vault.clear(password);
        return true;
      } catch {
        return false;
      }
    });
  }

  static async deleteVault() {
    if (!(await db.vault.exists())) return false;
    return await showPasswordDialog(
      "delete_vault",
      async ({ password, deleteAllLockedNotes }) => {
        if (!password) return false;
        if (!(await db.user.verifyPassword(password))) return false;
        await db.vault.delete(!!deleteAllLockedNotes);
        return true;
      }
    );
  }

  /**
   *
   * @returns {Promise<boolean>}
   */
  static unlockVault() {
    return showPasswordDialog("ask_vault_password", ({ password }) => {
      if (!password) return false;
      return db.vault
        .unlock(password)
        .then(() => true)
        .catch(() => false);
    });
  }

  static changeVaultPassword() {
    return showPasswordDialog(
      "change_password",
      async ({ oldPassword, newPassword }) => {
        if (!oldPassword || !newPassword) return false;
        await db.vault.changePassword(oldPassword, newPassword);
        showToast("success", "Vault password changed.");
        return true;
      }
    );
  }

  static unlockNote(id: string, type = "unlock_note") {
    return showPasswordDialog(type, ({ password }) => {
      if (!password) return false;
      return db.vault
        .remove(id, password)
        .then(() => true)
        .catch((e) => {
          console.error(e);
          return false;
        });
    });
  }

  static lockNote(id: string): Promise<boolean> {
    return db.vault
      .add(id)
      .then(() => false)
      .catch<boolean>(({ message }) => {
        switch (message) {
          case VAULT_ERRORS.noVault:
            return Vault.createVault();
          case VAULT_ERRORS.vaultLocked:
            return Vault.unlockVault();
          default:
            showToast("error", message);
            console.error(message);
            return false;
        }
      })
      .then((result) => (result ? this.lockNote(id) : result));
  }

  static askPassword(action: (password: string) => Promise<boolean>) {
    return showPasswordDialog("ask_vault_password", ({ password }) => {
      if (!password) return false;
      return action(password);
    });
  }
}
export default Vault;