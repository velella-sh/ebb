import { posix } from "node:path";
import { isDeepStrictEqual } from "node:util";

type SchemaObject = { [key: string]: unknown };
export type Schema = boolean | SchemaObject;
export type Catalog = ReadonlyMap<string, Schema>;
export type ChangeClass = "breaking" | "additive" | "editorial" | "unknown";
export interface Change {
  file: string;
  pointer: string;
  class: ChangeClass;
  message: string;
}

const annotations = new Set([
  "title",
  "description",
  "$comment",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
]);
const types = new Set(["null", "boolean", "object", "array", "number", "integer", "string"]);
const lowerBounds = new Set(["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"]);
const upperBounds = new Set(["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"]);
const object = (value: unknown): SchemaObject | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as SchemaObject) : undefined;
const schema = (value: unknown): Schema | undefined => (typeof value === "boolean" ? value : object(value));
const keys = (a: SchemaObject, b: SchemaObject) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
const child = (pointer: string, key: string) => pointer + "/" + key.replaceAll("~", "~0").replaceAll("/", "~1");
const own = (record: SchemaObject, key: string) => (Object.hasOwn(record, key) ? record[key] : undefined);
const list = (value: unknown): readonly unknown[] | undefined => (Array.isArray(value) ? value : undefined);
const difference = (a: readonly unknown[], b: readonly unknown[]) =>
  a.filter((item) => !b.some((other) => isDeepStrictEqual(item, other)));

function typeSet(value: unknown): ReadonlySet<unknown> | undefined {
  if (value === undefined) return types;
  const found = typeof value === "string" ? [value] : list(value);
  if (!found?.length || found.some((item) => typeof item !== "string" || !types.has(item))) return;
  return new Set(found.includes("number") ? [...found, "integer"] : found);
}

interface Reference {
  file: string;
  pointer: string;
  value: Schema;
}
function resolveRef(catalog: Catalog, from: string, reference: unknown): Reference | undefined {
  if (typeof reference !== "string") return;
  const [location = "", fragment = ""] = reference.split("#", 2);
  const knownId = [...catalog].find(([, document]) => object(document)?.$id === location)?.[0];
  const file = !location
    ? from
    : (knownId ??
      (/^[a-z][a-z\d+.-]*:|^\//iu.test(location)
        ? undefined
        : posix.normalize(posix.join(posix.dirname(from), location))));
  if (!file || !catalog.has(file)) return;

  let pointer: string;
  try {
    pointer = decodeURIComponent(fragment);
  } catch {
    return;
  }
  if (pointer && !pointer.startsWith("/")) return;
  let value: unknown = catalog.get(file);
  for (const key of pointer ? pointer.slice(1).split("/") : []) {
    const name = key.replaceAll("~1", "/").replaceAll("~0", "~");
    const record = object(value);
    const items = list(value);
    value = record ? own(record, name) : items && /^(?:0|[1-9][0-9]*)$/u.test(name) ? items[Number(name)] : undefined;
  }
  const target = schema(value);
  return target === undefined ? undefined : { file, pointer, value: target };
}

function unambiguousProperties(old: SchemaObject, current: SchemaObject, key: string): boolean {
  const uncertain = [
    "propertyNames",
    "if",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "unevaluatedProperties",
    "dependentSchemas",
    "dependentRequired",
  ];
  if (uncertain.some((keyword) => Object.hasOwn(old, keyword) || Object.hasOwn(current, keyword))) return false;
  return [old, current].every((node) =>
    Object.keys(object(node.patternProperties) ?? {}).every((pattern) => {
      try {
        return !new RegExp(pattern, "u").test(key);
      } catch {
        return false;
      }
    }),
  );
}

export function compareCatalogs(before: Catalog, after: Catalog): Change[] {
  const changes: Change[] = [];
  const ids = new Map<string, string>();
  for (const [file, document] of [...after].sort(([a], [b]) => (a < b ? -1 : Number(a > b)))) {
    const id = object(document)?.$id;
    if (typeof id !== "string") continue;
    const other = ids.get(id);
    if (other) {
      changes.push({
        file,
        pointer: "/$id",
        class: "unknown",
        message: `Canonical ID also appears in ${JSON.stringify(other)}.`,
      });
    } else ids.set(id, file);
  }

  for (const file of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const seenRefs = new Set<string>();
    const first = before.get(file);
    const last = after.get(file);
    const emit = (pointer: string, changeClass: ChangeClass, message: string) => {
      changes.push({ file, pointer, class: changeClass, message });
    };
    if (first === undefined || last === undefined) {
      const added = first === undefined;
      emit("", added ? "additive" : "breaking", added ? "Schema file added." : "Released schema file removed.");
      continue;
    }

    function compare(old: unknown, current: unknown, pointer: string, oldFile = file, newFile = file): void {
      if (isDeepStrictEqual(old, current)) return;
      const a = object(old);
      const b = object(current);
      if (!a || !b) {
        if (old === false || current === true) emit(pointer, "additive", "Relaxed a boolean schema.");
        else if (old === true || current === false) emit(pointer, "breaking", "Restricted a boolean schema.");
        else emit(pointer, "unknown", "Unsupported schema shape.");
        return;
      }
      if (pointer && (Object.hasOwn(a, "$id") || Object.hasOwn(b, "$id"))) {
        emit(pointer, "unknown", "Changes inside a nested schema resource need a scope review.");
        return;
      }
      const compareChild = (x: unknown, y: unknown, at: string) => compare(x, y, at, oldFile, newFile);

      for (const key of keys(a, b)) {
        const at = child(pointer, key);
        const x = own(a, key);
        const y = own(b, key);
        if (key === "$ref") {
          const oldTarget = resolveRef(before, oldFile, x);
          const newTarget = resolveRef(after, newFile, y);
          if (!oldTarget || !newTarget) {
            emit(at, "unknown", "Reference is external, unresolved or replaces an inline schema.");
          } else if (oldTarget.file !== newTarget.file || oldTarget.pointer !== newTarget.pointer) {
            const pair = JSON.stringify([oldTarget.file, oldTarget.pointer, newTarget.file, newTarget.pointer]);
            if (seenRefs.has(pair) || oldTarget.file !== newTarget.file) {
              emit(at, "unknown", "Reference moved across scopes or into a cycle.");
            } else {
              seenRefs.add(pair);
              const count = changes.length;
              compare(oldTarget.value, newTarget.value, at, oldTarget.file, newTarget.file);
              if (changes.length === count)
                emit(at, "editorial", "Reference spelling or location changed without a detected constraint change.");
              seenRefs.delete(pair);
            }
          } else if (x !== y) {
            emit(at, "editorial", "Reference spelling changed, with the same local target.");
          }
          // The map traversal checks shared definitions once at their declared pointers.
          continue;
        }
        if (isDeepStrictEqual(x, y)) continue;
        if (annotations.has(key)) {
          emit(at, "editorial", "Schema annotation changed.");
        } else if (key === "$id") {
          emit(at, x === undefined ? "unknown" : "breaking", "Canonical schema identifier changed.");
        } else if (key === "required" || key === "enum") {
          const oldList = x === undefined && key === "required" ? [] : list(x);
          const newList = y === undefined && key === "required" ? [] : list(y);
          if (key === "enum" && (x === undefined || y === undefined)) {
            emit(at, x === undefined ? "breaking" : "additive", "Enum constraint changed.");
          } else if (!oldList || !newList) {
            emit(at, "unknown", `Unsupported ${key} shape.`);
          } else {
            const removed = difference(oldList, newList);
            const added = difference(newList, oldList);
            if (removed.length)
              emit(at, key === "enum" ? "breaking" : "additive", `Removed ${key}: ${JSON.stringify(removed)}.`);
            if (added.length)
              emit(at, key === "enum" ? "additive" : "breaking", `Added ${key}: ${JSON.stringify(added)}.`);
          }
        } else if (key === "type") {
          const oldTypes = typeSet(x);
          const newTypes = typeSet(y);
          if (!oldTypes || !newTypes) emit(at, "unknown", "Unsupported type declaration.");
          else if ([...oldTypes].some((value) => !newTypes.has(value)))
            emit(at, "breaking", "Previously accepted types were restricted.");
          else if ([...newTypes].some((value) => !oldTypes.has(value)))
            emit(at, "additive", "Additional types are accepted.");
        } else if (key === "const") {
          emit(at, y === undefined ? "additive" : "breaking", "Constant constraint changed.");
        } else if (key === "pattern") {
          emit(
            at,
            x === undefined ? "breaking" : y === undefined ? "additive" : "unknown",
            "Pattern changed; compare accepted strings.",
          );
        } else if (lowerBounds.has(key) || upperBounds.has(key)) {
          if (x === undefined || y === undefined || (typeof x === "number" && typeof y === "number")) {
            const tighter =
              y !== undefined &&
              (x === undefined || (lowerBounds.has(key) ? Number(y) > Number(x) : Number(y) < Number(x)));
            emit(at, tighter ? "breaking" : "additive", `${key} changed.`);
          } else emit(at, "unknown", `Unsupported ${key} constraint.`);
        } else if (key === "additionalProperties" || key === "items") {
          compareChild(x ?? true, y ?? true, at);
        } else if (key === "properties" || key === "$defs" || key === "patternProperties") {
          const oldFields = object(x) ?? {};
          const newFields = object(y) ?? {};
          for (const name of keys(oldFields, newFields)) {
            const field = child(at, name);
            const previous = own(oldFields, name);
            const next = own(newFields, name);
            if (previous !== undefined && next !== undefined) compareChild(previous, next, field);
            else if (key === "$defs") {
              emit(
                field,
                next === undefined ? "unknown" : "additive",
                next === undefined ? "Definition removed; check its consumers." : "Local definition added.",
              );
            } else if (key === "patternProperties" || !unambiguousProperties(a, b, name)) {
              emit(field, "unknown", "Property name coverage changed; check overlapping constraints.");
            } else if (next === undefined) {
              emit(field, b.additionalProperties === false ? "breaking" : "unknown", "Declared property removed.");
            } else if (list(b.required)?.includes(name)) {
              emit(field, "breaking", "Required property added.");
            } else if (a.additionalProperties === false || isDeepStrictEqual(next, a.additionalProperties ?? true)) {
              emit(field, "additive", "Optional property added.");
            } else {
              emit(field, "unknown", "New property can restrict a previously permitted additional value.");
            }
          }
        } else if (key === "allOf" && Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
          if (difference(x, y).length || difference(y, x).length) {
            for (const [index, branch] of x.entries()) compareChild(branch, y[index], child(at, String(index)));
          }
        } else {
          emit(at, "unknown", `Changed ${key} needs a compatibility review.`);
        }
      }
    }
    compare(first, last, "");
  }
  return changes;
}
