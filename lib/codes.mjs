// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * CONTRACT_CODES, the refusal codes of the contract-directory reader and of the links check, read from
 * `data/codes.json` (docs/contract-dir.md). A refusal is raised by the code's name and carries the code; nothing
 * classifies a refusal by its text.
 */
import { readFileSync } from 'node:fs';

export const CODES_FILE = new URL('../data/codes.json', import.meta.url);

/** `{ <lowerCamel name>: <code> }`, in the file's order. */
export const CONTRACT_CODES = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(CODES_FILE, 'utf8')).CONTRACT_CODES.codes).map(([k, c]) => [k, c.code]),
);

/** A refusal: `code` is a CONTRACT_CODES code, `file` what it was found in, the message what was found. */
export class ContractRefusal extends Error {
  constructor(name, file, message) {
    if (!(name in CONTRACT_CODES)) throw new Error(`no contract code named ${name}`);
    super(message);
    this.code = CONTRACT_CODES[name];
    this.file = file;
  }

  /** The one line a refusal is printed as: its code first. */
  line() { return `${this.code} ${this.file}: ${this.message}`; }

  toJSON() { return { code: this.code, file: this.file, message: this.message }; }
}

/** Raise the refusal named `name`. */
export function refuse(name, file, message) { throw new ContractRefusal(name, file, message); }
