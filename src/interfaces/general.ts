export interface AnyObject<T> {
  [key: string]: T;
}
const NS_PER_SEC = 1e9;
const MS_PER_NS = 1e-6;

export const getProcessTime = ([seconds, nanoseconds]: [number, number]) => {
  return (seconds * NS_PER_SEC + nanoseconds) * MS_PER_NS;
};
