<script lang="ts">
	import { onMount } from 'svelte';
	import { exportAll, importAll, clearAll, type BackupPayload } from '$lib/db';
	import { activeSession } from '$lib/activeSession.svelte';

	const LAST_EXPORT_KEY = 'snus-last-export';
	const STALE_AFTER_DAYS = 7;

	let status = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let lastExportMs = $state<number | null>(null);

	onMount(() => {
		const raw = localStorage.getItem(LAST_EXPORT_KEY);
		lastExportMs = raw ? Number(raw) : null;
	});

	let daysSinceExport = $derived(
		lastExportMs ? Math.floor((Date.now() - lastExportMs) / 86_400_000) : null
	);
	let isStale = $derived(daysSinceExport === null || daysSinceExport >= STALE_AFTER_DAYS);

	let lastExportLabel = $derived.by(() => {
		if (lastExportMs === null) return 'Never';
		if (daysSinceExport === 0) return 'Today';
		if (daysSinceExport === 1) return 'Yesterday';
		return `${daysSinceExport} days ago`;
	});

	async function handleExport() {
		const payload = await exportAll();
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const ts = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
		a.href = url;
		a.download = `snus-tracker-${ts}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		const now = Date.now();
		localStorage.setItem(LAST_EXPORT_KEY, String(now));
		lastExportMs = now;
		status = 'Backup downloaded.';
	}

	async function handleImport(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text) as BackupPayload;
			if (data.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.sessions)) {
				throw new Error('Not a valid backup file.');
			}
			const mode = confirm(
				'Replace all current data with this backup?\n\nOK = Replace (deletes current data first)\nCancel = Merge (keeps current data, adds backup on top)'
			)
				? 'replace'
				: 'merge';
			await importAll(data, mode);
			await activeSession.refresh();
			status = `Imported ${data.products.length} products and ${data.sessions.length} sessions (${mode}).`;
		} catch (err) {
			status = `Import failed: ${(err as Error).message}`;
		} finally {
			input.value = '';
		}
	}

	async function handleClear() {
		const ok = confirm('Delete ALL products and sessions? This cannot be undone.');
		if (!ok) return;
		const ok2 = confirm('Are you really sure? Consider exporting a backup first.');
		if (!ok2) return;
		await clearAll();
		await activeSession.refresh();
		status = 'All data cleared.';
	}
</script>

<h1>Settings</h1>

<div class="card">
	<h2 style="margin-top:0">Backup</h2>
	<p class="muted">Your data lives only on this device. Export regularly to be safe.</p>
	<p class="backup-status" class:stale={isStale}>
		Last backup: <strong>{lastExportLabel}</strong>
		{#if isStale && lastExportMs !== null}
			· <span class="warn">overdue</span>
		{/if}
	</p>
	<div class="row" style="margin-top: 0.75rem">
		<button onclick={handleExport}>Export JSON</button>
		<button class="secondary" onclick={() => fileInput?.click()}>Import JSON…</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			onchange={handleImport}
			style="display:none"
		/>
	</div>
</div>

<div class="card">
	<h2 style="margin-top:0">Danger zone</h2>
	<p class="muted">Erases all products and sessions from this device.</p>
	<div class="row" style="margin-top: 0.75rem">
		<button class="danger" onclick={handleClear}>Clear all data</button>
	</div>
</div>

{#if status}
	<p class="status">{status}</p>
{/if}

<style>
	.status {
		margin-top: 1rem;
		color: var(--accent);
		font-size: 0.9375rem;
	}

	.backup-status {
		margin: 0.25rem 0 0;
		font-size: 0.9375rem;
	}

	.backup-status.stale {
		color: #fbbf24;
	}

	.warn {
		color: var(--danger);
		font-weight: 500;
	}
</style>
