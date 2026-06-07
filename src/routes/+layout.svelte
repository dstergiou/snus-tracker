<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { activeSession } from '$lib/activeSession.svelte';
	import { seedIfEmpty } from '$lib/db';
	import InstallHint from '$lib/InstallHint.svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		const init = async () => {
			await seedIfEmpty();
			await activeSession.refresh();
		};
		init();

		const onVisibility = () => {
			if (!document.hidden) activeSession.refresh();
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	const tabs = [
		{ href: `${base}/`, label: 'Home', icon: '⏱' },
		{ href: `${base}/history`, label: 'History', icon: '📊' },
		{ href: `${base}/products`, label: 'Products', icon: '🏷' },
		{ href: `${base}/settings`, label: 'Settings', icon: '⚙' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === `${base}/`) return path === `${base}/` || path === base;
		return path.startsWith(href);
	}
</script>

<svelte:head>
	<title>Snus Tracker</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#0f172a" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Snus" />
</svelte:head>

<div class="app">
	<main class="content">
		<InstallHint />
		{@render children()}
	</main>

	<nav class="tabbar">
		{#each tabs as tab (tab.href)}
			<a class="tab" class:active={isActive(tab.href)} href={tab.href}>
				<span class="tab-icon" aria-hidden="true">{tab.icon}</span>
				<span class="tab-label">{tab.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		background: var(--bg);
		color: var(--fg);
	}

	.content {
		flex: 1;
		padding: calc(1rem + env(safe-area-inset-top)) calc(1rem + env(safe-area-inset-right))
			calc(72px + env(safe-area-inset-bottom)) calc(1rem + env(safe-area-inset-left));
		max-width: 640px;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.tabbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		background: var(--surface);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 10;
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.25rem 0.625rem;
		gap: 0.125rem;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.75rem;
	}

	.tab.active {
		color: var(--accent);
	}

	.tab-icon {
		font-size: 1.25rem;
		line-height: 1;
	}
</style>
