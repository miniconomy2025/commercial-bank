export function snakeToCamelCaseMapper(obj: Record<string, any>): Record<string, any> {
  const toCamel = (str: string): string =>
    str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamel(key);
      result[camelKey] = obj[key];
    }
  }

  return result;
}
