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

export type ScriptTargetType = 'MAMORI' | 'SQL';

export type ScriptParamType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'json_array'
  | 'resultset';

export type ScriptParamDirection = 'in' | 'out' | 'inout';

export interface ScriptParameterColumn {
  name: string;
  type: Exclude<ScriptParamType, 'resultset'>;
}

export interface ScriptParameter {
  name: string;
  direction: ScriptParamDirection;
  type: ScriptParamType;
  default?: any;
  columns?: ScriptParameterColumn[];
}

/** null = unrestricted; [] = deny high-risk mamori.* ops */
export type ScriptCapabilities = string[] | null;

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

function extractId(result: any): number | undefined {
  const row = firstRow(result);
  if (row == null) {
    return undefined;
  }
  if (typeof row === 'number') {
    return row;
  }
  if (typeof row === 'object') {
    const v = col(row, 'result') ?? col(row, 'id') ?? Object.values(row)[0];
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number(row);
  return Number.isFinite(n) ? n : undefined;
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

export class Script implements ISerializable {
  id?: number;
  name: string;
  target_type: ScriptTargetType;
  target_name: string | null;
  language: string;
  body: string;
  parameters: ScriptParameter[];
  capabilities: ScriptCapabilities;

  public constructor(
    name: string,
    targetType: ScriptTargetType = 'MAMORI',
    body: string = '',
  ) {
    this.name = name;
    this.target_type = targetType;
    this.target_name = null;
    this.body = body;
    this.language = targetType === 'MAMORI' ? 'text/javascript' : 'text/sql';
    this.parameters = [];
    this.capabilities = null;
  }

  public static build(ds: any): Script {
    const s = new Script(
      String(col(ds, 'name') ?? ''),
      String(col(ds, 'target_type') || 'MAMORI').toUpperCase() as ScriptTargetType,
      String(col(ds, 'body') || ''),
    );
    s.fromJSON(ds);
    return s;
  }

  public static async list(api: MamoriService): Promise<Script[]> {
    const res = await api.select('SELECT * FROM SYS.SCRIPTS ORDER BY name');
    return queryRows(res).map((r: any) => Script.build(r));
  }

  public static async getByName(api: MamoriService, name: string): Promise<Script | null> {
    const res = await api.select(
      `SELECT * FROM SYS.SCRIPTS WHERE lower(name) = lower('${name.replace(/'/g, "''")}')`,
    );
    const rows = queryRows(res);
    if (rows.length === 0) {
      return null;
    }
    return Script.build(rows[0]);
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
    const targetType = col(record, 'target_type');
    if (targetType != null) {
      this.target_type = String(targetType).toUpperCase() as ScriptTargetType;
    }
    const targetName = col(record, 'target_name');
    this.target_name = targetName == null || targetName === '' ? null : String(targetName);
    const language = col(record, 'language');
    if (language != null) {
      this.language = String(language);
    }
    const body = col(record, 'body');
    if (body != null) {
      this.body = String(body);
    }
    let parameters = col(record, 'parameters');
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch {
        parameters = [];
      }
    }
    this.parameters = Array.isArray(parameters) ? parameters : [];
    let capabilities = col(record, 'capabilities');
    if (typeof capabilities === 'string') {
      try {
        capabilities = JSON.parse(capabilities);
      } catch {
        capabilities = null;
      }
    }
    this.capabilities = capabilities == null ? null : capabilities;
    return this;
  }

  toJSON(): any {
    const res: any = {};
    for (const prop in this) {
      res[prop] = (this as any)[prop];
    }
    return res;
  }

  withBody(body: string): Script {
    this.body = body;
    return this;
  }

  withTarget(targetType: ScriptTargetType, targetName: string | null = null): Script {
    this.target_type = targetType;
    this.target_name = targetName;
    this.language = targetType === 'MAMORI' ? 'text/javascript' : 'text/sql';
    return this;
  }

  withParameters(parameters: ScriptParameter[]): Script {
    this.parameters = parameters;
    return this;
  }

  withCapabilities(capabilities: ScriptCapabilities): Script {
    this.capabilities = capabilities;
    return this;
  }

  public async create(api: MamoriService): Promise<any> {
    const result = await api.call(
      'CREATE_SCRIPT',
      this.name,
      this.target_type,
      this.target_name,
      this.body,
      JSON.stringify(this.parameters || []),
      this.capabilities == null ? null : JSON.stringify(this.capabilities),
    );
    const id = extractId(result);
    if (id != null) {
      this.id = id;
    }
    return result;
  }

  public async update(api: MamoriService): Promise<any> {
    if (this.id == null) {
      throw new Error('Script id is required for update');
    }
    return api.call(
      'UPDATE_SCRIPT',
      this.id,
      this.name,
      this.target_type,
      this.target_name,
      this.body,
      JSON.stringify(this.parameters || []),
      this.capabilities == null ? null : JSON.stringify(this.capabilities),
    );
  }

  public async delete(api: MamoriService): Promise<any> {
    if (this.id == null) {
      throw new Error('Script id is required for delete');
    }
    return api.call('DELETE_SCRIPT', this.id);
  }

  public async run(api: MamoriService, inputs: Record<string, any> = {}): Promise<any> {
    const result = await api.call('RUN_SCRIPT', this.name, JSON.stringify(inputs || {}));
    const row = firstRow(result);
    if (row && typeof row === 'object') {
      const out: any = {
        success: col(row, 'success'),
        result: col(row, 'result'),
        error: col(row, 'error'),
      };
      if (typeof out.result === 'string') {
        try {
          out.result = JSON.parse(out.result);
        } catch {
          /* keep string */
        }
      }
      if (out.success === 'true' || out.success === true) {
        out.success = true;
      } else if (out.success === 'false' || out.success === false) {
        out.success = false;
      }
      return out;
    }
    return row ?? result;
  }
}
