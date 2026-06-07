import type { Session } from './db';
import { getActiveSession, startSession, stopActiveSession } from './db';

export const MAX_SESSION_MS = 30 * 60 * 1000;

class ActiveSessionStore {
	current = $state<Session | undefined>(undefined);
	nowMs = $state<number>(Date.now());
	private tickTimer: ReturnType<typeof setInterval> | undefined;
	private autoStopTimer: ReturnType<typeof setTimeout> | undefined;

	async refresh() {
		const active = await getActiveSession();
		if (active) {
			const age = Date.now() - active.startAt;
			if (age >= MAX_SESSION_MS) {
				await stopActiveSession(active.startAt + MAX_SESSION_MS);
				this.current = undefined;
			} else {
				this.current = active;
			}
		} else {
			this.current = undefined;
		}
		this.syncTimers();
	}

	async start(productId: number) {
		const session = await startSession(productId);
		this.current = session;
		this.syncTimers();
	}

	async stop() {
		await stopActiveSession();
		this.current = undefined;
		this.syncTimers();
	}

	elapsedMs(): number {
		if (!this.current) return 0;
		return this.nowMs - this.current.startAt;
	}

	private syncTimers() {
		if (this.current) {
			this.nowMs = Date.now();
			if (!this.tickTimer) {
				this.tickTimer = setInterval(() => {
					this.nowMs = Date.now();
				}, 1000);
			}
			if (this.autoStopTimer) clearTimeout(this.autoStopTimer);
			const remaining = Math.max(0, this.current.startAt + MAX_SESSION_MS - Date.now());
			this.autoStopTimer = setTimeout(async () => {
				await stopActiveSession(this.current!.startAt + MAX_SESSION_MS);
				this.current = undefined;
				this.syncTimers();
			}, remaining);
		} else {
			if (this.tickTimer) {
				clearInterval(this.tickTimer);
				this.tickTimer = undefined;
			}
			if (this.autoStopTimer) {
				clearTimeout(this.autoStopTimer);
				this.autoStopTimer = undefined;
			}
		}
	}
}

export const activeSession = new ActiveSessionStore();
