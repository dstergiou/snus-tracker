import type { Product, Session } from './db';

export interface Bucket {
	key: string;
	label: string;
	startMs: number;
	endMs: number;
	sessions: Session[];
	totalPouches: number;
	totalDurationMs: number;
	totalCost: number;
	perProduct: Map<number, { count: number; durationMs: number; cost: number }>;
}

export type Granularity = 'day' | 'week' | 'month';

const DAY_MS = 86_400_000;

function startOfDay(ms: number): Date {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d;
}

function startOfWeek(ms: number): Date {
	const d = startOfDay(ms);
	const day = d.getDay();
	const diff = (day + 6) % 7; // Monday as start of week
	d.setDate(d.getDate() - diff);
	return d;
}

function startOfMonth(ms: number): Date {
	const d = new Date(ms);
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

function bucketStart(ms: number, granularity: Granularity): Date {
	if (granularity === 'day') return startOfDay(ms);
	if (granularity === 'week') return startOfWeek(ms);
	return startOfMonth(ms);
}

function bucketEnd(start: Date, granularity: Granularity): Date {
	const end = new Date(start);
	if (granularity === 'day') end.setDate(end.getDate() + 1);
	else if (granularity === 'week') end.setDate(end.getDate() + 7);
	else end.setMonth(end.getMonth() + 1);
	return end;
}

function bucketKey(start: Date, granularity: Granularity): string {
	const y = start.getFullYear();
	const m = String(start.getMonth() + 1).padStart(2, '0');
	const d = String(start.getDate()).padStart(2, '0');
	if (granularity === 'month') return `${y}-${m}`;
	return `${y}-${m}-${d}`;
}

function bucketLabel(start: Date, granularity: Granularity): string {
	if (granularity === 'day') {
		return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}
	if (granularity === 'week') {
		const end = bucketEnd(start, 'week');
		end.setDate(end.getDate() - 1);
		const sameMonth = start.getMonth() === end.getMonth();
		const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const endStr = sameMonth
			? String(end.getDate())
			: end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		return `${startStr} – ${endStr}`;
	}
	return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function durationOf(session: Session, nowMs: number): number {
	const end = session.endAt ?? nowMs;
	return Math.max(0, end - session.startAt);
}

export function bucketize(sessions: Session[], granularity: Granularity, nowMs = Date.now()): Bucket[] {
	const map = new Map<string, Bucket>();
	for (const s of sessions) {
		const start = bucketStart(s.startAt, granularity);
		const key = bucketKey(start, granularity);
		let bucket = map.get(key);
		if (!bucket) {
			const end = bucketEnd(start, granularity);
			bucket = {
				key,
				label: bucketLabel(start, granularity),
				startMs: start.getTime(),
				endMs: end.getTime(),
				sessions: [],
				totalPouches: 0,
				totalDurationMs: 0,
				totalCost: 0,
				perProduct: new Map()
			};
			map.set(key, bucket);
		}
		bucket.sessions.push(s);
		bucket.totalPouches += 1;
		bucket.totalDurationMs += durationOf(s, nowMs);
		bucket.totalCost += s.costSnapshot;
		const pp = bucket.perProduct.get(s.productId) ?? { count: 0, durationMs: 0, cost: 0 };
		pp.count += 1;
		pp.durationMs += durationOf(s, nowMs);
		pp.cost += s.costSnapshot;
		bucket.perProduct.set(s.productId, pp);
	}
	return Array.from(map.values()).sort((a, b) => b.startMs - a.startMs);
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return '0s';
	const totalSeconds = Math.floor(ms / 1000);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTime(ms: number): string {
	return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const costFormatter = new Intl.NumberFormat('sv-SE', {
	style: 'currency',
	currency: 'SEK',
	maximumFractionDigits: 2
});

export function formatCost(amount: number): string {
	return costFormatter.format(amount);
}

export function productNameById(products: Product[]): (id: number) => string {
	const map = new Map(products.map((p) => [p.id!, p.name]));
	return (id) => map.get(id) ?? 'Deleted product';
}
