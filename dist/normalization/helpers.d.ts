type Nullable<T> = T | null;
export declare function asString(value: unknown): Nullable<string>;
export declare function cleanEmail(value: unknown): Nullable<string>;
export declare function emailDomain(email: Nullable<string>): Nullable<string>;
export declare function parseTimestamp(value: unknown): Nullable<Date>;
export declare function normalizePhone(value: unknown): {
    raw: Nullable<string>;
    e164: Nullable<string>;
};
export declare function buildFullName(first: Nullable<string>, last: Nullable<string>): Nullable<string>;
export declare function pickFirstString(props: Record<string, any>, keys: string[]): Nullable<string>;
export declare function pickFirstTimestamp(props: Record<string, any>, keys: string[]): Nullable<Date>;
export declare function safeJson(value: any): any;
export {};
//# sourceMappingURL=helpers.d.ts.map