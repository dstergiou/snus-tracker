<script lang="ts">
	import { liveQuery } from 'dexie';
	import {
		db,
		deleteSession,
		updateSession,
		type Product,
		type Session
	} from '$lib/db';
	import {
		bucketize,
		formatDuration,
		formatTime,
		formatCost,
		productNameById,
		type Granularity
	} from '$lib/aggregate';
	import { activeSession } from '$lib/activeSession.svelte';

	const sessions = liveQuery<Session[]>(() => db.sessions.orderBy('startAt').reverse().toArray());
	const products = liveQuery<Product[]>(() => db.products.toArray());

	let granularity = $state<Granularity>('day');
	let expanded = $state<Set<string>>(new Set());
	let editingId = $state<number | null>(null);
	let editProductId = $state<number>(0);
	let editStart = $state<string>('');
	let editEnd = $state<string>('');
	let editIsActive = $state<boolean>(false);

	let buckets = $derived.by(() => {
		if (!$sessions) return [];
		return bucketize($sessions, granularity, activeSession.nowMs);
	});

	let nameFor = $derived(productNameById($products ?? []));

	function toggle(key: string) {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expanded = next;
	}

	function toLocalInput(ms: number): string {
		const d = new Date(ms);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function fromLocalInput(value: string): number {
		return new Date(value).getTime();
	}

	function openEdit(session: Session) {
		editingId = session.id!;
		editProductId = session.productId;
		editStart = toLocalInput(session.startAt);
		editIsActive = session.endAt === null;
		editEnd = session.endAt === null ? '' : toLocalInput(session.endAt);
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit() {
		if (editingId == null) return;
		const startAt = fromLocalInput(editStart);
		let endAt: number | null = null;
		if (!editIsActive) {
			endAt = fromLocalInput(editEnd);
			if (endAt < startAt) {
				alert('End time must be after start time.');
				return;
			}
		}
		await updateSession(editingId, { productId: editProductId, startAt, endAt });
		editingId = null;
		await activeSession.refresh();
	}

	async function removeSession(id: number) {
		const ok = confirm('Delete this session?');
		if (!ok) return;
		await deleteSession(id);
		if (editingId === id) editingId = null;
		await activeSession.refresh();
	}
</script>

<h1>History</h1>

<div class="segmented" role="tablist">
	{#each [{ k: 'day', l: 'Day' }, { k: 'week', l: 'Week' }, { k: 'month', l: 'Month' }] as opt (opt.k)}
		<button
			class="seg"
			class:active={granularity === opt.k}
			onclick={() => (granularity = opt.k as Granularity)}
		>
			{opt.l}
		</button>
	{/each}
</div>

{#if $sessions === undefined}
	<p class="muted">Loading…</p>
{:else if buckets.length === 0}
	<div class="empty">
		<p>No sessions yet.</p>
		<p>Start tracking from the Home tab to build history.</p>
	</div>
{:else}
	<div class="stack">
		{#each buckets as bucket (bucket.key)}
			<div class="card">
				<button class="bucket-head" onclick={() => toggle(bucket.key)}>
					<div class="bucket-title">{bucket.label}</div>
					<div class="bucket-stats">
						<span>{bucket.totalPouches} {bucket.totalPouches === 1 ? 'pouch' : 'pouches'}</span>
						<span>·</span>
						<span>{formatDuration(bucket.totalDurationMs)}</span>
						<span>·</span>
						<span>{formatCost(bucket.totalCost)}</span>
					</div>
				</button>

				{#if bucket.perProduct.size > 0}
					<div class="breakdown">
						{#each [...bucket.perProduct.entries()] as [pid, stat] (pid)}
							<div class="break-row">
								<span>{nameFor(pid)}</span>
								<span class="muted">
									{stat.count} · {formatDuration(stat.durationMs)} · {formatCost(stat.cost)}
								</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if expanded.has(bucket.key)}
					<div class="sessions">
						{#each bucket.sessions as s (s.id)}
							{@const endMs = s.endAt ?? activeSession.nowMs}
							{#if editingId === s.id}
								<div class="edit-form">
									<div class="field">
										<label for="e-prod-{s.id}">Product</label>
										<select id="e-prod-{s.id}" bind:value={editProductId}>
											{#each $products ?? [] as p (p.id)}
												<option value={p.id}>{p.name}</option>
											{/each}
										</select>
									</div>
									<div class="field">
										<label for="e-start-{s.id}">Start</label>
										<input
											id="e-start-{s.id}"
											type="datetime-local"
											bind:value={editStart}
										/>
									</div>
									{#if !editIsActive}
										<div class="field">
											<label for="e-end-{s.id}">End</label>
											<input
												id="e-end-{s.id}"
												type="datetime-local"
												bind:value={editEnd}
											/>
										</div>
									{:else}
										<p class="muted small">This session is still active. Stop it from Home to set an end time.</p>
									{/if}
									<div class="row">
										<button onclick={saveEdit}>Save</button>
										<button class="secondary" onclick={cancelEdit}>Cancel</button>
										<button class="ghost danger-text" onclick={() => removeSession(s.id!)}>Delete</button>
									</div>
								</div>
							{:else}
								<button class="session-row" onclick={() => openEdit(s)}>
									<div class="s-name">
										{nameFor(s.productId)}{#if s.endAt === null}<span class="live"> · live</span>{/if}
									</div>
									<div class="s-meta muted">
										{formatTime(s.startAt)} – {s.endAt === null ? '…' : formatTime(s.endAt)}
										· {formatDuration(endMs - s.startAt)}
										· {formatCost(s.costSnapshot)}
									</div>
								</button>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.25rem;
		margin-bottom: 1rem;
	}

	.seg {
		background: transparent;
		color: var(--muted);
		padding: 0.5rem 0.75rem;
		font-weight: 500;
		border-radius: 0.375rem;
	}

	.seg.active {
		background: var(--accent);
		color: #00131f;
	}

	.bucket-head {
		all: unset;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		cursor: pointer;
		width: 100%;
	}

	.bucket-title {
		font-weight: 600;
	}

	.bucket-stats {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.breakdown {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
	}

	.break-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.sessions {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.session-row {
		all: unset;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.s-name {
		font-weight: 500;
	}

	.s-meta {
		font-size: 0.8125rem;
	}

	.live {
		color: var(--accent);
		font-weight: 500;
	}

	.edit-form {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	.danger-text {
		color: var(--danger);
	}

	.small {
		font-size: 0.8125rem;
	}
</style>
