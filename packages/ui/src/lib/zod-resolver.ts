import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

type ErrorNode = { [key: string]: ErrorNode | { type: string; message: string } };

/**
 * Minimal React Hook Form resolver for Zod 4 schemas (avoids @hookform/resolvers' optional
 * peer-dependency tree). Maps each issue to its field path; the first issue per field wins.
 */
export function zodResolver<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
): Resolver<z.input<TSchema>, unknown, z.output<TSchema>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: ErrorNode = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.map(String) : ["root"];
      let node = errors;
      for (const segment of path.slice(0, -1)) {
        const next = node[segment];
        if (!next || "message" in next) node[segment] = {};
        node = node[segment] as ErrorNode;
      }
      const leaf = path.at(-1)!;
      node[leaf] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<z.input<TSchema>> };
  };
}
