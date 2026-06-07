import Dexie, { type Table } from 'dexie';
import seed from '../../products.json';

export interface Product {
	id?: number;
	name: string;
	nicotineMg: number;
	costPerPouch: number;
	createdAt: number;
}

export interface Session {
	id?: number;
	productId: number;
	startAt: number;
	endAt: number | null;
	costSnapshot: number;
}

class SnussDB extends Dexie {
	products!: Table<Product, number>;
	sessions!: Table<Session, number>;

	constructor() {
		// IndexedDB name kept as the original to preserve user data after the project rename.
		super('snuss-tracker');
		this.version(1).stores({
			products: '++id, name, createdAt',
			sessions: '++id, productId, startAt, endAt'
		});
	}
}

export const db = new SnussDB();

export async function listProducts(): Promise<Product[]> {
	return db.products.orderBy('createdAt').toArray();
}

export async function addProduct(input: Omit<Product, 'id' | 'createdAt'>): Promise<number> {
	return db.products.add({ ...input, createdAt: Date.now() });
}

export async function updateProduct(id: number, patch: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
	await db.products.update(id, patch);
}

export async function deleteProduct(id: number): Promise<void> {
	await db.products.delete(id);
}

export async function getActiveSession(): Promise<Session | undefined> {
	return db.sessions.filter((s) => s.endAt === null).first();
}

export async function startSession(productId: number): Promise<Session> {
	return db.transaction('rw', db.products, db.sessions, async () => {
		const product = await db.products.get(productId);
		if (!product) throw new Error(`Product ${productId} not found`);

		const active = await db.sessions.filter((s) => s.endAt === null).first();
		if (active) {
			await db.sessions.update(active.id!, { endAt: Date.now() });
		}

		const startAt = Date.now();
		const id = await db.sessions.add({
			productId,
			startAt,
			endAt: null,
			costSnapshot: product.costPerPouch
		});
		return { id, productId, startAt, endAt: null, costSnapshot: product.costPerPouch };
	});
}

export async function stopActiveSession(endAt: number = Date.now()): Promise<void> {
	const active = await getActiveSession();
	if (active?.id != null) {
		await db.sessions.update(active.id, { endAt });
	}
}

export async function updateSession(
	id: number,
	patch: Partial<Pick<Session, 'productId' | 'startAt' | 'endAt' | 'costSnapshot'>>
): Promise<void> {
	await db.sessions.update(id, patch);
}

export async function deleteSession(id: number): Promise<void> {
	await db.sessions.delete(id);
}

export async function listSessions(): Promise<Session[]> {
	return db.sessions.orderBy('startAt').reverse().toArray();
}

export async function listSessionsInRange(fromMs: number, toMs: number): Promise<Session[]> {
	return db.sessions
		.where('startAt')
		.between(fromMs, toMs, true, true)
		.reverse()
		.sortBy('startAt')
		.then((arr) => arr.reverse());
}

export interface BackupPayload {
	version: 1;
	exportedAt: number;
	products: Product[];
	sessions: Session[];
}

export async function exportAll(): Promise<BackupPayload> {
	const [products, sessions] = await Promise.all([
		db.products.toArray(),
		db.sessions.toArray()
	]);
	return { version: 1, exportedAt: Date.now(), products, sessions };
}

export type ImportMode = 'replace' | 'merge';

export async function importAll(payload: BackupPayload, mode: ImportMode): Promise<void> {
	if (payload.version !== 1) throw new Error(`Unsupported backup version: ${payload.version}`);
	await db.transaction('rw', db.products, db.sessions, async () => {
		if (mode === 'replace') {
			await db.products.clear();
			await db.sessions.clear();
		}
		await db.products.bulkPut(payload.products);
		await db.sessions.bulkPut(payload.sessions);
	});
}

export async function seedIfEmpty(): Promise<boolean> {
	const count = await db.products.count();
	if (count > 0) return false;
	const seedProducts = (seed as BackupPayload).products;
	if (!seedProducts || seedProducts.length === 0) return false;
	await db.products.bulkPut(seedProducts);
	return true;
}

export async function clearAll(): Promise<void> {
	await db.transaction('rw', db.products, db.sessions, async () => {
		await db.products.clear();
		await db.sessions.clear();
	});
}
