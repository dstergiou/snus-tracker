<script lang="ts">
	import { liveQuery } from 'dexie';
	import {
		db,
		addProduct,
		updateProduct,
		deleteProduct,
		type Product
	} from '$lib/db';
	import { formatCost } from '$lib/aggregate';

	const products = liveQuery<Product[]>(() => db.products.orderBy('createdAt').toArray());

	let editingId = $state<number | 'new' | null>(null);
	let formName = $state('');
	let formMg = $state<number>(0);
	let formCost = $state<number>(0);

	function openNew() {
		editingId = 'new';
		formName = '';
		formMg = 0;
		formCost = 0;
	}

	function openEdit(p: Product) {
		editingId = p.id!;
		formName = p.name;
		formMg = p.nicotineMg;
		formCost = p.costPerPouch;
	}

	function cancel() {
		editingId = null;
	}

	async function save() {
		const name = formName.trim();
		if (!name) return;
		const payload = {
			name,
			nicotineMg: Number(formMg) || 0,
			costPerPouch: Number(formCost) || 0
		};
		if (editingId === 'new') {
			await addProduct(payload);
		} else if (typeof editingId === 'number') {
			await updateProduct(editingId, payload);
		}
		editingId = null;
	}

	async function remove(p: Product) {
		const ok = confirm(`Delete "${p.name}"? Past sessions stay in your history.`);
		if (!ok) return;
		await deleteProduct(p.id!);
	}
</script>

<div class="row between">
	<h1>Products</h1>
	{#if editingId === null}
		<button onclick={openNew}>+ Add</button>
	{/if}
</div>

{#if editingId !== null}
	<div class="card">
		<div class="field">
			<label for="p-name">Name</label>
			<input id="p-name" type="text" bind:value={formName} placeholder="e.g. VELO Ice Cool" />
		</div>
		<div class="field">
			<label for="p-mg">Nicotine (mg)</label>
			<input id="p-mg" type="number" inputmode="decimal" step="0.1" min="0" bind:value={formMg} />
		</div>
		<div class="field">
			<label for="p-cost">Cost per pouch (SEK)</label>
			<input
				id="p-cost"
				type="number"
				inputmode="decimal"
				step="0.01"
				min="0"
				bind:value={formCost}
			/>
		</div>
		<div class="row">
			<button onclick={save}>Save</button>
			<button class="secondary" onclick={cancel}>Cancel</button>
		</div>
	</div>
{/if}

{#if $products === undefined}
	<p class="muted">Loading…</p>
{:else if $products.length === 0 && editingId === null}
	<div class="empty">
		<p>No products yet.</p>
		<button onclick={openNew}>Add a product</button>
	</div>
{:else}
	<div class="stack">
		{#each $products as product (product.id)}
			<div class="card product-row">
				<div class="info">
					<div class="name">{product.name}</div>
					<div class="meta muted">
						{product.nicotineMg} mg · {formatCost(product.costPerPouch)} / pouch
					</div>
				</div>
				<div class="actions">
					<button class="ghost" onclick={() => openEdit(product)}>Edit</button>
					<button class="ghost danger-text" onclick={() => remove(product)}>Delete</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.product-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.info {
		min-width: 0;
	}

	.name {
		font-weight: 600;
	}

	.meta {
		font-size: 0.8125rem;
		margin-top: 0.125rem;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
	}

	.danger-text {
		color: var(--danger);
	}
</style>
