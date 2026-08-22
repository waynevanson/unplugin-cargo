export class WatchQueue {
	private pending: {
		resolve: () => void;
		reject: (error: Error) => void;
	} | null = null;

	wait(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.pending = { resolve, reject };
		});
	}

	resolve(): void {
		if (!this.pending) return;
		const { resolve } = this.pending;
		this.pending = null;
		resolve();
	}

	reject(error: Error): void {
		if (!this.pending) return;
		const { reject } = this.pending;
		this.pending = null;
		reject(error);
	}
}
