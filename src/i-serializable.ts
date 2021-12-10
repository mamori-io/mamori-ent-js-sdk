
export interface ISerializable {
    fromJSON(record: any): any;
    toJSON(): any;
}