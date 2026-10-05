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

export interface ScriptFlowMappingSpec {
  /** Canvas / step block id of the source block */
  from: string;
  name: string;
}

export interface ScriptFlowStepDef {
  id?: string;
  script?: string;
  type?: 'script' | 'loop' | 'filter';
  name?: string;
  mode?: 'serial' | 'parallel';
  method?: 'first_n' | 'random_n' | 'columns' | 'script';
  count?: number;
  column_filters?: Array<{ column: string; value?: string }>;
  mappings?: Record<string, ScriptFlowMappingSpec | any>;
  steps?: ScriptFlowStepDef[];
}

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

export class ScriptFlow implements ISerializable {
  id?: number;
  name: string;
  steps: ScriptFlowStepDef[];

  public constructor(name: string, steps: ScriptFlowStepDef[] = []) {
    this.name = name;
    this.steps = steps;
  }

  public static build(ds: any): ScriptFlow {
    const flow = new ScriptFlow(String(col(ds, 'name') ?? ''), []);
    flow.fromJSON(ds);
    return flow;
  }

  public static async list(api: MamoriService): Promise<ScriptFlow[]> {
    const res = await api.select('SELECT * FROM SYS.SCRIPT_FLOWS ORDER BY name');
    return queryRows(res).map((r: any) => ScriptFlow.build(r));
  }

  public static async getByName(api: MamoriService, name: string): Promise<ScriptFlow | null> {
    const res = await api.select(
      `SELECT * FROM SYS.SCRIPT_FLOWS WHERE lower(name) = lower('${name.replace(/'/g, "''")}')`,
    );
    const rows = queryRows(res);
    if (rows.length === 0) {
      return null;
    }
    const flow = ScriptFlow.build(rows[0]);
    const stepsRes = await api.select(
      `SELECT * FROM SYS.SCRIPT_FLOW_STEPS WHERE flow_id = ${flow.id} ORDER BY position`,
    );
    flow.steps = queryRows(stepsRes).map((s: any) => {
      let mappings = {};
      const raw = col(s, 'input_mappings');
      if (raw) {
        try {
          mappings = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          mappings = {};
        }
      }
      return {
        script: String(col(s, 'script_name') ?? ''),
        mappings,
      };
    });
    return flow;
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
    if (!Array.isArray(this.steps)) {
      this.steps = [];
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

  withSteps(steps: ScriptFlowStepDef[]): ScriptFlow {
    this.steps = steps;
    return this;
  }

  public async create(api: MamoriService): Promise<any> {
    const result = await api.call('CREATE_SCRIPT_FLOW', this.name, JSON.stringify(this.steps || []), null, '[]');
    const id = extractId(result);
    if (id != null) {
      this.id = id;
    }
    return result;
  }

  public async update(api: MamoriService): Promise<any> {
    if (this.id == null) {
      throw new Error('ScriptFlow id is required for update');
    }
    return api.call('UPDATE_SCRIPT_FLOW', this.id, this.name, JSON.stringify(this.steps || []), null, '[]');
  }

  public async delete(api: MamoriService): Promise<any> {
    if (this.id == null) {
      throw new Error('ScriptFlow id is required for delete');
    }
    return api.call('DELETE_SCRIPT_FLOW', this.id);
  }

  public async run(api: MamoriService, inputs: Record<string, any> = {}): Promise<any> {
    const result = await api.call('RUN_SCRIPT_FLOW', this.name, JSON.stringify(inputs || {}));
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
