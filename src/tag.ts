/*
 * Copyright (c) 2026 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from './api';
import { ISerializable } from './i-serializable';
import { sqlEscape } from './utils';

/** Resource types accepted by ASSIGN_TAG / CLEAR_TAG */
export type TagResourceType =
  | 'datasource'
  | 'ssh'
  | 'rdp'
  | 'http'
  | 'ip'
  | 'secret'
  | 'user'
  | 'role'
  | 'db_object'
  | 'script'
  | 'script_flow';

function firstRow(result: any): any {
  if (!result) {
    return null;
  }
  if (Array.isArray(result)) {
    return result[0] ?? null;
  }
  if (Array.isArray(result.data)) {
    return result.data[0] ?? null;
  }
  if (Array.isArray(result.rows)) {
    return result.rows[0] ?? null;
  }
  return result;
}

function col(row: any, name: string): any {
  if (!row) {
    return undefined;
  }
  if (row[name] !== undefined) {
    return row[name];
  }
  const upper = name.toUpperCase();
  if (row[upper] !== undefined) {
    return row[upper];
  }
  const lower = name.toLowerCase();
  if (row[lower] !== undefined) {
    return row[lower];
  }
  return undefined;
}

function queryRows(res: any): any[] {
  if (!res) {
    return [];
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (Array.isArray(res.rows)) {
    return res.rows;
  }
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

export type TagKind = 'SYSTEM' | 'CUSTOM';

export class Tag implements ISerializable {
  id?: number;
  name: string;
  name_norm?: string;
  color?: string;
  tag_kind?: TagKind;
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  public constructor(name: string, color?: string) {
    this.name = name;
    this.color = color;
  }

  public get isSystem(): boolean {
    return String(this.tag_kind || '').toUpperCase() === 'SYSTEM';
  }

  public static build(ds: any): Tag {
    const t = new Tag(String(col(ds, 'name') ?? ''));
    t.fromJSON(ds);
    return t;
  }

  public static async list(api: MamoriService): Promise<Tag[]> {
    const res = await api.select('SELECT * FROM SYS.TAGS ORDER BY name');
    return queryRows(res).map((r: any) => Tag.build(r));
  }

  public static async getByName(api: MamoriService, name: string): Promise<Tag | null> {
    const res = await api.select(
      `SELECT * FROM SYS.TAGS WHERE lower(name) = lower('${sqlEscape(name)}')`,
    );
    const rows = queryRows(res);
    if (rows.length === 0) {
      return null;
    }
    return Tag.build(rows[0]);
  }

  public static async getById(api: MamoriService, id: number): Promise<Tag | null> {
    const res = await api.select(`SELECT * FROM SYS.TAGS WHERE id = ${Number(id)}`);
    const rows = queryRows(res);
    if (rows.length === 0) {
      return null;
    }
    return Tag.build(rows[0]);
  }

  public static async listAssignments(
    api: MamoriService,
    tagId?: number,
  ): Promise<any[]> {
    // Do not ORDER BY SYS.TAG_ASSIGNMENTS string columns: Hub maps them as LONG NVARCHAR,
    // which Derby rejects in ORDER BY (SQLException). Sort client-side instead.
    let sql = 'SELECT * FROM SYS.TAG_ASSIGNMENTS';
    if (tagId != null) {
      sql += ` WHERE tag_id = ${Number(tagId)}`;
    }
    const rows = queryRows(await api.select(sql));
    rows.sort((a: any, b: any) => {
      const at = String(col(a, 'resource_type') ?? '');
      const bt = String(col(b, 'resource_type') ?? '');
      if (at !== bt) {
        return at.localeCompare(bt);
      }
      return String(col(a, 'resource_key') ?? '').localeCompare(String(col(b, 'resource_key') ?? ''));
    });
    return rows;
  }

  fromJSON(record: any) {
    const id = col(record, 'id');
    if (id != null) {
      this.id = Number(id);
    }
    const name = col(record, 'name');
    if (name != null) {
      this.name = String(name);
    }
    const nameNorm = col(record, 'name_norm');
    if (nameNorm != null) {
      this.name_norm = String(nameNorm);
    }
    const color = col(record, 'color');
    if (color != null) {
      this.color = String(color);
    }
    const tagKind = col(record, 'tag_kind');
    if (tagKind != null) {
      const kind = String(tagKind).toUpperCase();
      this.tag_kind = kind === 'SYSTEM' ? 'SYSTEM' : 'CUSTOM';
    }
    const createdBy = col(record, 'created_by');
    if (createdBy != null) {
      this.created_by = String(createdBy);
    }
    const createdAt = col(record, 'created_at');
    if (createdAt != null) {
      this.created_at = String(createdAt);
    }
    const updatedAt = col(record, 'updated_at');
    if (updatedAt != null) {
      this.updated_at = String(updatedAt);
    }
    return this;
  }

  toJSON(): any {
    const res: any = {};
    for (const prop in this) {
      res[prop] = (this as any)[prop];
    }
    return res;
  }

  withColor(color: string): Tag {
    this.color = color;
    return this;
  }

  withName(name: string): Tag {
    this.name = name;
    return this;
  }

  /**
   * Create the tag via ADD_TAG(name, options).
   * Pass color on the Tag (or omit for Hub to assign a unique unused color).
   */
  public async create(api: MamoriService): Promise<any> {
    const options =
      this.color != null && String(this.color).trim() !== ''
        ? JSON.stringify({ color: String(this.color).trim().toUpperCase() })
        : null;
    const result = await api.call('ADD_TAG', this.name, options);
    const row = firstRow(result);
    if (row && typeof row === 'object') {
      this.fromJSON(row);
    }
    return result;
  }

  /**
   * Update name and/or color via UPDATE_TAG.
   * Pass null/undefined for a field to leave it unchanged on the server.
   * SYSTEM tags cannot be renamed — name is always sent as null for SYSTEM.
   */
  public async update(api: MamoriService, name?: string | null, color?: string | null): Promise<any> {
    if (this.id == null) {
      throw new Error('Tag id is required for update');
    }
    // SYSTEM tags are recolor-only; never send a rename.
    const nextName = this.isSystem ? null : name === undefined ? this.name : name;
    const nextColor = color === undefined ? this.color : color;
    const nameArg = nextName == null || nextName === '' ? null : nextName;
    const colorArg = nextColor == null || nextColor === '' ? null : nextColor;
    if (nameArg == null && colorArg == null) {
      throw new Error(this.isSystem ? 'System tags cannot be renamed' : 'Nothing to update');
    }
    const result = await api.call('UPDATE_TAG', this.id, nameArg, colorArg);
    const row = firstRow(result);
    if (row && typeof row === 'object') {
      this.fromJSON(row);
    } else {
      if (nameArg != null) {
        this.name = nameArg;
      }
      if (colorArg != null) {
        this.color = colorArg;
      }
    }
    return result;
  }

  /**
   * Delete by id. Hub cascades deletes into all mamorisys.*_tags link tables.
   */
  public async delete(api: MamoriService): Promise<any> {
    if (this.id == null) {
      throw new Error('Tag id is required for delete');
    }
    return api.call('DELETE_TAG', this.id);
  }

  public async deleteByName(api: MamoriService): Promise<any> {
    return api.call('DELETE_TAG_BY_NAME', this.name);
  }

  public async assign(
    api: MamoriService,
    resourceType: TagResourceType,
    resourceKey: string,
  ): Promise<any> {
    if (this.id == null) {
      throw new Error('Tag id is required for assign');
    }
    return api.call('ASSIGN_TAG', resourceType, resourceKey, this.id);
  }

  /**
   * Clear this tag from a resource, or pass '*' to clear all tags on the resource.
   */
  public async clear(
    api: MamoriService,
    resourceType: TagResourceType,
    resourceKey: string,
    tagIdOrStar: string | number = '*',
  ): Promise<any> {
    const spec =
      tagIdOrStar === '*'
        ? '*'
        : String(tagIdOrStar === undefined || tagIdOrStar === null ? this.id : tagIdOrStar);
    return api.call('CLEAR_TAG', resourceType, resourceKey, spec);
  }
}
