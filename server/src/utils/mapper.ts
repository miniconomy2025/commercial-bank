type SnakeToCamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamelCase<Tail>>}`
  : S;

type SnakeObjToCamelObj<T extends object> = { [K in keyof T as SnakeToCamelCase<K & string>]: T[K]; };

const toCamel = <const S extends string>(str: S): SnakeToCamelCase<S> =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as SnakeToCamelCase<S>;


export function snakeToCamelCaseMapper<const T extends object>(obj: T): SnakeObjToCamelObj<T> {
  const result = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = toCamel(key);
      // @ts-ignore
      result[camelKey] = obj[key];
    }
  }

  return result as SnakeObjToCamelObj<T>;
}