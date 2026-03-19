type IdSuffix = "Id" | "id" | "ID" | "iD";

export function removeIdSuffix<T extends string>(
  name: T
): T extends `${infer R}${IdSuffix}` ? R : T {
  if (name.length >= 2 && name.slice(-2).toLowerCase() === "id") {
    return name.slice(0, -2) as T extends `${infer R}${IdSuffix}` ? R : T;
  }
  return name as T extends `${infer R}${IdSuffix}` ? R : T;
}