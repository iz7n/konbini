// This is mainly the observables in https://github.com/jbreckmckye/trkl with the Svelte store contract and a few new functions

type Subscriber<T> = (newValue: T, oldValue?: T) => any;
type Subscribe<T> = (subscriber: Subscriber<T>) => () => void;

interface Store<T> {
  (): T;
  (updater: (oldValue: T) => T): T;
  (newValue: T): T;
  set(newValue: T): T;
  update(updater: (oldValue: T) => T): T;
  subscribe: Subscribe<T>;
  unsubscribe(subscriber: Subscriber<any>): void;
}

const computedStack: (() => void)[] = [];

export default function konbini<T>(value?: T): Store<T> {
  const subscribers = new Set<Subscriber<T>>();

  function read(): T {
    const runningComputation = computedStack.at(-1);
    if (runningComputation) subscribers.add(runningComputation);
    return value as T;
  }

  // @ts-ignore
  const store: Store<T> = (...args) => {
    if (!args.length) return read();

    const newValue: T =
      typeof args[0] === 'function' ? args[0](read()) : args[0];
    if (newValue === value) return;

    const oldValue = value;
    value = newValue;

    subscribers.forEach(subscriber => subscriber(newValue, oldValue));
  };
  store.set = value => store(value);
  store.update = updater => {
    const newValue = updater(store());
    return store(newValue);
  };
  store.subscribe = subscriber => {
    subscribers.add(subscriber);
    subscriber(value as T);
    return () => subscribers.delete(subscriber);
  };
  store.unsubscribe = subscriber => subscribers.delete(subscriber);

  return store;
}

export function computed<T>(executor: () => T): Store<T> {
  const store = konbini<T>();

  function computation() {
    if (computedStack.includes(computation))
      throw new Error('Circular computation');

    computedStack.push(computation);
    let result: T;
    let error: unknown;
    try {
      result = executor();
    } catch (e) {
      error = e;
    }
    computedStack.pop();
    if (error) throw error;
    // @ts-ignore
    store(result);
  }
  computation();

  return store;
}

export function from<T>(executor: (store: Store<T>) => any, initialValue?: T) {
  const store = konbini(initialValue);
  executor(store);
  return store;
}
