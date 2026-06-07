<script lang="ts">
	import { onMount } from 'svelte';

	const DISMISS_KEY = 'snus-install-dismissed';

	let show = $state(false);

	onMount(() => {
		if (localStorage.getItem(DISMISS_KEY) === '1') return;

		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (isStandalone) return;

		const ua = navigator.userAgent;
		const isIOS = /iPhone|iPad|iPod/.test(ua);
		const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
		if (!isIOS || !isSafari) return;

		show = true;
	});

	function dismiss() {
		localStorage.setItem(DISMISS_KEY, '1');
		show = false;
	}
</script>

{#if show}
	<div class="banner">
		<div class="head">
			<strong>Install Snus Tracker</strong>
			<button class="x" aria-label="Dismiss" onclick={dismiss}>×</button>
		</div>
		<ol>
			<li>Tap the Share button <span class="icon">⎋</span></li>
			<li>Scroll and tap <strong>Add to Home Screen</strong></li>
			<li>Tap <strong>Add</strong> in the top-right</li>
		</ol>
	</div>
{/if}

<style>
	.banner {
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 0.75rem;
		padding: 0.75rem 0.875rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.x {
		all: unset;
		cursor: pointer;
		color: var(--muted);
		font-size: 1.25rem;
		line-height: 1;
		padding: 0 0.25rem;
	}

	ol {
		margin: 0.25rem 0 0;
		padding-left: 1.125rem;
		color: var(--muted);
	}

	li + li {
		margin-top: 0.125rem;
	}

	.icon {
		display: inline-block;
		transform: translateY(-1px);
		color: var(--accent);
	}
</style>
