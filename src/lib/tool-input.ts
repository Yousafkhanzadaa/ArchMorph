/** Validate equally in native WebMCP, the local console, and a batch sandbox. */
export function assertToolInput(value: unknown, schema: Record<string, unknown>, path = "input"): void {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (schema.type && !types.includes(actual)) throw new Error(`${path} must be a ${types.join(" or ")}.`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) throw new Error(`${path} must be one of ${schema.enum.join(", ")}.`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must be finite.`);
    if (typeof schema.minimum === "number" && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}.`);
    if (typeof schema.maximum === "number" && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}.`);
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) throw new Error(`${path} must be greater than ${schema.exclusiveMinimum}.`);
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) throw new Error(`${path} is too short.`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) throw new Error(`${path} is too long.`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) throw new Error(`${path} requires at least ${schema.minItems} items.`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) throw new Error(`${path} allows at most ${schema.maxItems} items.`);
    if (schema.items) value.forEach((item, i) => assertToolInput(item, schema.items as Record<string, unknown>, `${path}[${i}]`));
  } else if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>, properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const required of (schema.required ?? []) as string[]) if (object[required] === undefined) throw new Error(`${path}.${required} is required.`);
    for (const [key, item] of Object.entries(object)) {
      if (item === undefined) continue;
      if (properties[key]) assertToolInput(item, properties[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`${path}.${key} is not supported.`);
    }
  }
}
