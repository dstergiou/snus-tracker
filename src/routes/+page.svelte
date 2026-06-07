<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db, type Product, type Session } from '$lib/db';
	import { activeSession } from '$lib/activeSession.svelte';
	import { formatElapsed, formatCost, formatDuration } from '$lib/aggregate';

	const products = liveQuery<Product[]>(() => db.products.orderBy('createdAt').toArray());

	function startOfToday(): number {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}

	const todaySessions = liveQuery<Session[]>(() =>
		db.sessions.where('startAt').aboveOrEqual(startOfToday()).sortBy('startAt')
	);

	let elapsed = $derived(activeSession.elapsedMs());

	let todayStats = $derived.by(() => {
		const list = $todaySessions ?? [];
		if (list.length === 0) return null;
		const count = list.length;
		const cost = list.reduce((sum, s) => sum + s.costSnapshot, 0);
		let avgGapMs: number | null = null;
		if (count >= 2) {
			const gaps: number[] = [];
			for (let i = 1; i < list.length; i++) {
				gaps.push(list[i].startAt - list[i - 1].startAt);
			}
			avgGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
		}
		return { count, cost, avgGapMs };
	});

	function activeProduct(list: Product[] | undefined): Product | undefined {
		if (!list || !activeSession.current) return undefined;
		return list.find((p) => p.id === activeSession.current!.productId);
	}

	async function handleStart(productId: number) {
		await activeSession.start(productId);
	}

	async function handleStop() {
		await activeSession.stop();
	}
</script>

<h1>Snus Tracker</h1>

{#if activeSession.current}
	{@const active = activeProduct($products)}
	<div class="active-banner">
		<div class="banner-label">Active</div>
		<div class="banner-product">{active?.name ?? 'Unknown product'}</div>
		<div class="banner-timer">{formatElapsed(elapsed)}</div>
		<button class="danger" onclick={handleStop}>Stop</button>
	</div>
{/if}

{#if todayStats}
	<div class="today">
		<div class="today-label">Today</div>
		<div class="today-stats">
			<div class="stat">
				<div class="stat-value">{todayStats.count}</div>
				<div class="stat-label">{todayStats.count === 1 ? 'pouch' : 'pouches'}</div>
			</div>
			<div class="stat">
				<div class="stat-value">{formatCost(todayStats.cost)}</div>
				<div class="stat-label">spent</div>
			</div>
			{#if todayStats.avgGapMs !== null}
				<div class="stat">
					<div class="stat-value">{formatDuration(todayStats.avgGapMs)}</div>
					<div class="stat-label">avg gap</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if $products === undefined}
	<p class="muted">Loading…</p>
{:else if $products.length === 0}
	<div class="empty">
		<p>No products yet.</p>
		<p><a href="/products" class="link">Add your first product →</a></p>
	</div>
{:else}
	<div class="stack">
		{#each $products as product (product.id)}
			{@const isActive = activeSession.current?.productId === product.id}
			<div class="card product-card" class:active={isActive}>
				<div class="product-info">
					<div class="product-name">{product.name}</div>
					<div class="product-meta muted">
						{product.nicotineMg} mg · {formatCost(product.costPerPouch)} / pouch
					</div>
				</div>
				{#if isActive}
					<button class="danger" onclick={handleStop}>Stop</button>
				{:else if activeSession.current}
					<button class="secondary" onclick={() => handleStart(product.id!)}>Switch</button>
				{:else}
					<button onclick={() => handleStart(product.id!)}>Start</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.active-banner {
		background: linear-gradient(135deg, var(--accent), var(--accent-strong));
		color: #00131f;
		border-radius: 1rem;
		padding: 1.25rem;
		margin-bottom: 1.25rem;
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 0.25rem 1rem;
		align-items: center;
	}

	.banner-label {
		grid-column: 1;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.7;
	}

	.banner-product {
		grid-column: 1;
		font-weight: 600;
		font-size: 1.25rem;
	}

	.banner-timer {
		grid-column: 1;
		font-variant-numeric: tabular-nums;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.1;
	}

	.active-banner button {
		grid-column: 2;
		grid-row: 1 / span 3;
	}

	.product-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.product-card.active {
		border-color: var(--accent);
	}

	.product-info {
		min-width: 0;
	}

	.product-name {
		font-weight: 600;
		font-size: 1.0625rem;
	}

	.product-meta {
		font-size: 0.8125rem;
		margin-top: 0.125rem;
	}

	.link {
		color: var(--accent);
		text-decoration: none;
	}

	.today {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		margin-bottom: 1rem;
	}

	.today-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}

	.today-stats {
		display: flex;
		gap: 1.5rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.stat-value {
		font-size: 1.125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
