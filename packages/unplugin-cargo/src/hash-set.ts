import { type Hasher, type HasherOptions, hasher } from "node-object-hash";

export class HashSet<Value> implements Iterable<Value> {
	#hasher: Hasher;
	#map: Map<string, Value>;

	constructor(values?: Iterable<Value>, hasherOptions?: HasherOptions) {
		this.#hasher = hasher(hasherOptions);

		const entries = Array.from(
			values ?? [],
			(value) => [this.#hasher.hash(value), value] as const,
		);

		this.#map = new Map(entries);
	}

	private hash(value: Value) {
		return this.#hasher.hash(value);
	}

	findHashFromValue(predicate: (value: Value) => boolean): string | undefined {
		for (const [hash, value] of this.#map.entries()) {
			if (predicate(value)) {
				return hash;
			}
		}

		return undefined;
	}

	has(value: Value) {
		return this.#map.has(this.hash(value));
	}

	add(value: Value) {
		const hash = this.hash(value);
		this.#map.set(hash, value);
		return hash;
	}

	delete(value: Value) {
		const hash = this.hash(value);
		return this.#map.delete(hash);
	}

	values() {
		return this.#map.values();
	}

	entries() {
		return this.#map.entries();
	}

	hashes() {
		return this.#map.keys();
	}

	[Symbol.iterator]() {
		return this.values();
	}
}
