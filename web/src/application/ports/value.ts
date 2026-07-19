export interface ReadableValue<T> {
  readonly value: T;
}

export interface WritableValue<T> extends ReadableValue<T> {
  value: T;
}
