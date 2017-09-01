import * as mg from 'mongoose';
import { Class } from './types';
import { SchemaRegistry } from './registry';
import { ObjectUtil } from '@encore/util';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class SchemaValidator {

  static schemas: Map<Class, Map<string, mg.Schema>> = new Map();

  static getSchema<T>(cls: Class<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
    if (!this.schemas.has(cls)) {
      this.schemas.set(cls, new Map());
    }
    let viewMap: Map<string, mg.Schema> = this.schemas.get(cls) as Map<string, mg.Schema>;
    if (!viewMap.has(view)) {
      let config = SchemaRegistry.schemas.get(cls);
      if (!config || !config.views[view]) {
        throw new Error(`Unknown view found: ${view}`);
      }
      viewMap.set(view, this.getSchemaRaw(config.views[view].schema));
    }
    return viewMap.get(view) as mg.Schema;
  }

  static getSchemaRaw(schema: any, opts: mg.SchemaOptions = {}): mg.Schema {
    for (let key of Object.keys(schema)) {
      let isArray = Array.isArray(schema[key].type);
      let type = isArray ? schema[key].type[0] : schema[key].type;
      if (ObjectUtil.isPlainObject(type)) {
        let sub = this.getSchemaRaw(type);
        schema[key].type = isArray ? [sub] : sub;
      }
    }
    return new mongoose.Schema(schema, opts);
  }

  static async validateRaw<T>(o: T, schema: mg.Schema): Promise<T> {
    let doc = new mongoose.Document(o, schema);
    await doc.validate();
    return o;
  }

  static async validateAllRaw<T>(obj: T[], schema: mg.Schema): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validateRaw(o, schema)));
  }

  static async validate<T>(o: T, view?: string): Promise<T> {
    return await this.validateRaw(o, this.getSchema(SchemaRegistry.getClass(o), view));
  }

  static async validateAll<T>(obj: T[], view: string = SchemaRegistry.DEFAULT_VIEW): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validate(o, view)));
  }
}

SchemaRegistry.events.on('register', cls => {
  SchemaValidator.schemas.delete(cls); // Clear cache on new register
});